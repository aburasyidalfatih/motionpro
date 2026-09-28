import { readdir } from "node:fs/promises";
import path from "node:path";
import { moods } from "@/lib/ai/schemas";

// Library musik latar dan SFX yang dikurasi sendiri (lihat library/README.md):
//   library/music/<suasana>/*.mp3   misalnya library/music/epic/battle.mp3
//   library/sfx/*.mp3               misalnya library/sfx/whoosh-1.mp3

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".m4a"]);

export function libraryRoot() {
  return path.resolve(process.env.LIBRARY_DIR || "./library");
}

export type LibraryTrack = {
  // Path relatif terhadap library/music, misalnya "epic/battle.mp3".
  path: string;
  mood: string;
  name: string;
};

async function audioFiles(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isFile() && AUDIO_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort();
}

export async function listMusic(): Promise<LibraryTrack[]> {
  const tracks: LibraryTrack[] = [];
  for (const mood of moods) {
    for (const file of await audioFiles(path.join(libraryRoot(), "music", mood))) {
      tracks.push({ path: `${mood}/${file}`, mood, name: path.parse(file).name });
    }
  }
  return tracks;
}

export async function listSfx() {
  return audioFiles(path.join(libraryRoot(), "sfx"));
}

// Musik default: trek pertama dari suasana yang paling sering muncul di naskah,
// atau trek pertama mana pun bila suasana itu belum punya musik.
export function pickMusic(tracks: LibraryTrack[], sceneMoods: (string | null)[]) {
  const counts = new Map<string, number>();
  for (const mood of sceneMoods) if (mood) counts.set(mood, (counts.get(mood) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([mood]) => mood);
  for (const mood of ranked) {
    const track = tracks.find((t) => t.mood === mood);
    if (track) return track;
  }
  return tracks[0];
}

export function libraryUrl(relative: string) {
  return `/api/library/${relative.split("/").map(encodeURIComponent).join("/")}`;
}
