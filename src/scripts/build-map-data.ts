import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Membuat data peta ringkas untuk template video dari Natural Earth (domain
// publik, https://www.naturalearthdata.com): sungai, danau, dan kota. Hasilnya
// di-commit ke src/remotion/history/data agar render tidak butuh internet.
//   npm run map:data                   → unduh dari GitHub Natural Earth
//   NE_DIR=/folder/geojson npm run map:data   → pakai file .geojson lokal

const SOURCE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
const OUT_DIR = path.resolve("src/remotion/history/data");

type Position = [number, number];
type Geometry =
  | { type: "LineString"; coordinates: Position[] }
  | { type: "MultiLineString"; coordinates: Position[][] }
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] };
type Feature = { properties: Record<string, unknown>; geometry: Geometry | null };

async function load(name: string): Promise<Feature[]> {
  const text = process.env.NE_DIR
    ? await readFile(path.join(process.env.NE_DIR, `${name}.geojson`), "utf8")
    : await fetch(`${SOURCE}/${name}.geojson`).then((r) => {
        if (!r.ok) throw new Error(`${name}: ${r.status}`);
        return r.text();
      });
  return (JSON.parse(text) as { features: Feature[] }).features;
}

// Douglas–Peucker: membuang titik yang menyimpang kurang dari tolerance (derajat).
function simplify(points: Position[], tolerance: number): Position[] {
  if (points.length <= 2) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const length = Math.hypot(bx - ax, by - ay) || 1e-12;
  let index = 0;
  let max = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const distance = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
    if (distance > max) {
      max = distance;
      index = i;
    }
  }
  if (max <= tolerance) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}

// Cincin tertutup (awal = akhir) dibagi dua dulu; tanpa itu Douglas–Peucker
// membuang semua titik karena ujung-ujungnya berimpit.
function simplifyRing(points: Position[], tolerance: number): Position[] {
  const mid = Math.floor(points.length / 2);
  return [...simplify(points.slice(0, mid + 1), tolerance).slice(0, -1), ...simplify(points.slice(mid), tolerance)];
}

// Garis sebagai array datar [lng, lat, lng, lat, ...] yang dibulatkan, tanpa titik kembar.
function flatten(points: Position[], tolerance: number, digits: number, ring = false) {
  const factor = 10 ** digits;
  const flat: number[] = [];
  for (const [lng, lat] of ring ? simplifyRing(points, tolerance) : simplify(points, tolerance)) {
    const x = Math.round(lng * factor) / factor;
    const y = Math.round(lat * factor) / factor;
    if (flat.length && flat[flat.length - 2] === x && flat[flat.length - 1] === y) continue;
    flat.push(x, y);
  }
  return flat;
}

const rank = (f: Feature) => Math.round(Number(f.properties.scalerank ?? 10));

// [rank, garis, garis, ...] per sungai.
async function rivers(name: string, tolerance: number, digits: number) {
  const features = await load(name);
  return features.flatMap((f) => {
    const g = f.geometry;
    if (!g) return [];
    const lines = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
    const flat = lines.map((l) => flatten(l, tolerance, digits)).filter((l) => l.length >= 4);
    return flat.length ? [[rank(f), ...flat]] : [];
  });
}

// [rank, cincin, cincin, ...] per poligon danau (cincin pertama = tepi luar).
async function lakes(name: string, tolerance: number, digits: number) {
  const features = await load(name);
  return features.flatMap((f) => {
    const g = f.geometry;
    if (!g) return [];
    const polygons = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    return polygons.flatMap((rings) => {
      const flat = rings.map((r) => flatten(r, tolerance, digits, true)).filter((r) => r.length >= 8);
      return flat.length ? [[rank(f), ...flat]] : [];
    });
  });
}

// [nama, lng, lat, rank] per kota; rank kecil = kota penting.
async function places() {
  const features = await load("ne_10m_populated_places_simple");
  return features
    .map((f) => [
      String(f.properties.name),
      Math.round(Number(f.properties.longitude) * 1000) / 1000,
      Math.round(Number(f.properties.latitude) * 1000) / 1000,
      rank(f),
    ])
    .sort((a, b) => Number(a[3]) - Number(b[3]));
}

async function write(name: string, data: unknown) {
  const file = path.join(OUT_DIR, name);
  await writeFile(file, JSON.stringify(data));
  const kb = Math.round(Buffer.byteLength(JSON.stringify(data)) / 1024);
  console.log(`${path.relative(process.cwd(), file)} ${kb} KB`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await write("rivers-50m.json", await rivers("ne_50m_rivers_lake_centerlines", 0.02, 2));
  await write("rivers-10m.json", await rivers("ne_10m_rivers_lake_centerlines", 0.004, 3));
  await write("lakes-50m.json", await lakes("ne_50m_lakes", 0.02, 2));
  await write("lakes-10m.json", await lakes("ne_10m_lakes", 0.004, 3));
  await write("places.json", await places());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
