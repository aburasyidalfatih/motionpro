// Kata kunci dari naskah sering berupa frasa sinematik ("Majapahit empire
// cinematic intro"). Arsip seperti Wikimedia Commons mencari file yang memuat
// semua kata, sehingga frasa panjang tidak menemukan apa pun. Fungsi ini membuat
// variasi yang makin umum untuk dicoba berurutan.

const FILLER = new Set([
  // gaya sinematik
  "cinematic",
  "intro",
  "outro",
  "dramatic",
  "epic",
  "footage",
  "aerial",
  "closeup",
  "close-up",
  "shot",
  "view",
  "scene",
  "4k",
  "hd",
  "background",
  "style",
  "illustration",
  "depiction",
  "artistic",
  "concept",
  "reconstruction",
  "atmosphere",
  "atmospheric",
  "moody",
  "glowing",
  "silhouette",
  // kata sambung
  "a",
  "an",
  "the",
  "of",
  "in",
  "on",
  "over",
  "with",
  "and",
  "at",
  "by",
  "for",
  "from",
  "to",
  "during",
  // bahasa Indonesia
  "sejarah",
  "kisah",
  "dan",
  "di",
  "ke",
  "dari",
  "yang",
]);

export function queryVariants(query: string) {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const core = words.filter((w) => !FILLER.has(w.toLowerCase()));
  const variants = [words.join(" "), core.join(" "), core.slice(0, 3).join(" "), core.slice(0, 2).join(" ")];
  // Satu kata hanya dipakai bila berupa nama diri (huruf kapital), misalnya "Majapahit".
  if (core[0] && /^\p{Lu}/u.test(core[0])) variants.push(core[0]);
  return [...new Set(variants.filter(Boolean))];
}
