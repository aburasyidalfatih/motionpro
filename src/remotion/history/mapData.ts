import { geoArea, geoBounds } from "d3-geo";
import type { Feature, FeatureCollection, MultiLineString, Polygon, Position } from "geojson";
import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import land50 from "world-atlas/land-50m.json";

// Lapisan peta dari Natural Earth (domain publik): daratan dan batas negara dari
// world-atlas, sungai, danau, dan kota dari data/*.json (dibuat oleh
// `npm run map:data`). Semua lokal agar render tidak butuh internet; versi
// resolusi tinggi (10m) hanya dimuat untuk peta yang diperbesar.

export type Bounds = [[number, number], [number, number]];
type Shape<T> = { feature: T; bounds: Bounds };
export type Island = Shape<Feature<Polygon>>;
export type River = Shape<Feature<MultiLineString>> & { rank: number };
export type Lake = Shape<Feature<Polygon>> & { rank: number };
export type Border = Shape<Feature<MultiLineString>>;
export type Place = { name: string; lng: number; lat: number; rank: number };
export type Country = Shape<Feature> & { name: string };

export type MapLayers = {
  islands: Island[];
  rivers: River[];
  lakes: Lake[];
  borders: Border[];
  places: Place[];
  // Negara masa kini (resolusi 50m) untuk menyorot wilayah pihak yang bertikai.
  countries: Country[];
};

// Poligon yang arah titiknya terbalik dianggap d3 sebagai seluruh bumi kecuali
// poligon itu (luas > setengah bola); balikkan arahnya.
function polygon(rings: Position[][]): Feature<Polygon> {
  const shape: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: rings },
  };
  if (geoArea(shape) <= 2 * Math.PI) return shape;
  return { ...shape, geometry: { type: "Polygon", coordinates: rings.map((ring) => [...ring].reverse()) } };
}

const withBounds = <T extends Feature>(f: T) => ({ feature: f, bounds: geoBounds(f) as Bounds });

// Daratan dipecah per pulau/benua beserta kotak batasnya, agar hanya yang
// terlihat yang diproyeksikan. (Memotong seluruh daratan dunia dengan
// clipExtent membuat peta yang diperbesar terisi penuh warna daratan.)
function toIslands(topology: unknown): Island[] {
  const t = topology as Topology<{ land: GeometryCollection }>;
  const land = feature(t, t.objects.land) as FeatureCollection | Feature;
  const features = "features" in land ? land.features : [land];
  return features.flatMap((f) => {
    const g = f.geometry;
    const polygons = g.type === "MultiPolygon" ? g.coordinates : g.type === "Polygon" ? [g.coordinates] : [];
    return polygons.map((rings) => withBounds(polygon(rings)));
  });
}

// Batas antarnegara (tanpa garis pantai), dipecah per ruas.
function toBorders(topology: unknown): Border[] {
  const t = topology as Topology<{ countries: GeometryCollection }>;
  const lines = mesh(t, t.objects.countries, (a, b) => a !== b);
  return lines.coordinates.map((line) =>
    withBounds<Feature<MultiLineString>>({
      type: "Feature",
      properties: {},
      geometry: { type: "MultiLineString", coordinates: [line] },
    }),
  );
}

// Negara per nama. Poligon dengan arah titik terbalik diperbaiki seperti daratan.
function toCountries(topology: unknown): Country[] {
  const t = topology as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const collection = feature(t, t.objects.countries) as FeatureCollection;
  return collection.features.map((f) => {
    const g = f.geometry;
    const fixed: Feature =
      g.type === "Polygon"
        ? polygon(g.coordinates)
        : g.type === "MultiPolygon"
          ? {
              type: "Feature",
              properties: {},
              geometry: {
                type: "MultiPolygon",
                coordinates: g.coordinates.map((rings) => polygon(rings).geometry.coordinates),
              },
            }
          : f;
    return { name: String((f.properties as { name?: string } | null)?.name ?? ""), ...withBounds(fixed) };
  });
}

// Nama negara dari naskah (Inggris atau Indonesia) ke nama di Natural Earth.
const COUNTRY_ALIASES: Record<string, string> = {
  usa: "United States of America",
  us: "United States of America",
  "united states": "United States of America",
  "amerika serikat": "United States of America",
  amerika: "United States of America",
  uk: "United Kingdom",
  britain: "United Kingdom",
  "great britain": "United Kingdom",
  inggris: "United Kingdom",
  "britania raya": "United Kingdom",
  rusia: "Russia",
  "uni soviet": "Russia",
  "soviet union": "Russia",
  ussr: "Russia",
  tiongkok: "China",
  cina: "China",
  china: "China",
  jepang: "Japan",
  belanda: "Netherlands",
  prancis: "France",
  perancis: "France",
  jerman: "Germany",
  turki: "Turkey",
  mesir: "Egypt",
  "arab saudi": "Saudi Arabia",
  ukraina: "Ukraine",
  filipina: "Philippines",
  "korea selatan": "South Korea",
  "korea utara": "North Korea",
  italia: "Italy",
  spanyol: "Spain",
  portugis: "Portugal",
  yunani: "Greece",
  "selandia baru": "New Zealand",
  "timor leste": "Timor-Leste",
  palestina: "Palestine",
  irak: "Iraq",
  suriah: "Syria",
  yordania: "Jordan",
  lebanon: "Lebanon",
  kamboja: "Cambodia",
  "papua nugini": "Papua New Guinea",
};

const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function findCountry(countries: Country[], name: string) {
  const key = normalizeName(name);
  const target = normalizeName(COUNTRY_ALIASES[key] ?? name);
  return countries.find((c) => normalizeName(c.name) === target);
}

// Garis datar [lng, lat, lng, lat, ...] menjadi daftar posisi.
const positions = (flat: number[]): Position[] =>
  Array.from({ length: flat.length / 2 }, (_, i) => [flat[i * 2], flat[i * 2 + 1]]);

type Packed = [number, ...number[][]];

function toRivers(rows: unknown): River[] {
  return (rows as Packed[]).map(([rank, ...lines]) => ({
    rank,
    ...withBounds<Feature<MultiLineString>>({
      type: "Feature",
      properties: {},
      geometry: { type: "MultiLineString", coordinates: lines.map(positions) },
    }),
  }));
}

function toLakes(rows: unknown): Lake[] {
  return (rows as Packed[]).map(([rank, ...rings]) => ({ rank, ...withBounds(polygon(rings.map(positions))) }));
}

function toPlaces(rows: unknown): Place[] {
  return (rows as [string, number, number, number][]).map(([name, lng, lat, rank]) => ({ name, lng, lat, rank }));
}

let countriesPromise: Promise<Country[]> | undefined;
const countries = () =>
  (countriesPromise ??= import("world-atlas/countries-50m.json").then((m) => toCountries(m.default)));

// JSON besar diimpor dinamis agar tidak ikut bundle Player sejak awal.
const loaders = {
  wide: () =>
    Promise.all([
      toIslands(land50),
      import("world-atlas/countries-50m.json").then((m) => toBorders(m.default)),
      import("./data/rivers-50m.json").then((m) => toRivers(m.default)),
      import("./data/lakes-50m.json").then((m) => toLakes(m.default)),
      import("./data/places.json").then((m) => toPlaces(m.default)),
      countries(),
    ]),
  detailed: () =>
    Promise.all([
      import("world-atlas/land-10m.json").then((m) => toIslands(m.default)),
      import("world-atlas/countries-10m.json").then((m) => toBorders(m.default)),
      import("./data/rivers-10m.json").then((m) => toRivers(m.default)),
      import("./data/lakes-10m.json").then((m) => toLakes(m.default)),
      import("./data/places.json").then((m) => toPlaces(m.default)),
      countries(),
    ]),
};

const cache: Partial<Record<keyof typeof loaders, Promise<MapLayers>>> = {};

function loadLayers(kind: keyof typeof loaders) {
  cache[kind] ??= loaders[kind]().then(([islands, borders, rivers, lakes, places, countries]) => ({
    islands,
    borders,
    rivers,
    lakes,
    places,
    countries,
  }));
  return cache[kind];
}

const fallback: MapLayers = {
  islands: toIslands(land50),
  rivers: [],
  lakes: [],
  borders: [],
  places: [],
  countries: [],
};

// Lapisan peta untuk tingkat detail yang diminta; render menunggu sampai dimuat.
// continueRender baru dipanggil setelah lapisan tampil, agar komponen anak
// (MapBase) sempat memasang delayRender-nya sendiri lebih dulu.
export function useMapLayers(detailed: boolean) {
  const [layers, setLayers] = useState<MapLayers | null>(null);
  const [handle] = useState(() => delayRender("Memuat data peta"));
  useEffect(() => {
    let cancelled = false;
    loadLayers(detailed ? "detailed" : "wide")
      .catch(() => fallback)
      .then((result) => {
        if (!cancelled) setLayers(result);
      });
    return () => {
      cancelled = true;
    };
  }, [detailed]);
  useEffect(() => {
    if (layers) continueRender(handle);
  }, [layers, handle]);
  return layers;
}

// Bentuk yang kotak batasnya bersinggungan dengan area tampilan (plus margin).
export function visible<T extends { bounds: Bounds }>(shapes: T[], [[west, south], [east, north]]: Bounds) {
  const mx = (west <= east ? east - west : east + 360 - west) * 0.5;
  const my = (north - south) * 0.5;
  return shapes.filter(({ bounds: [[w, s], [e, n]] }) => {
    // Bentuk yang melintasi garis 180° dianggap selalu terlihat.
    if (w > e) return true;
    if (s > north + my || n < south - my) return false;
    // Area tampilan yang melintasi garis 180° punya west > east.
    return west <= east ? w <= east + mx && e >= west - mx : e >= west - mx || w <= east + mx;
  });
}
