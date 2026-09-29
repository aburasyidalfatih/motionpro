import { refresh } from "next/cache";
import { db } from "@/lib/db";

// Untuk server action per adegan. Adegan bisa sudah tidak ada saat tombolnya diklik:
// naskah dibuat ulang (semua adegan diganti dengan id baru) atau adegan dihapus di tab
// lain. Halaman cukup dimuat ulang agar menampilkan adegan yang sekarang, bukan galat.
export async function findSceneOrRefresh(sceneId: string) {
  const scene = await db.scene.findUnique({ where: { id: sceneId } });
  if (!scene) refresh();
  return scene;
}
