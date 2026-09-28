import { db } from "@/lib/db";

// Status tahap aset dan audio dihitung dari datanya: semua adegan punya aset
// terpilih → ASSETS_READY; ditambah semua adegan punya voice over → AUDIO_READY.
// Dipanggil setelah job aset/audio dan setelah adegan, aset, atau suara diubah.
export async function recomputeStatus(projectId: string) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  // Video yang sudah dirender menjadi usang bila adegan, aset, atau suara diubah,
  // jadi status RENDERED juga dihitung ulang (kembali ke AUDIO_READY).
  const inAssetAudioStage =
    ["SCRIPT_READY", "ASSETS_READY", "AUDIO_READY", "RENDERED"].includes(project.status) ||
    (project.status === "FAILED" && ["ASSETS", "AUDIO", "RENDER"].includes(project.failedStage ?? ""));
  if (!inAssetAudioStage) return;

  const [scenes, withAsset, withVoice] = await Promise.all([
    db.scene.count({ where: { projectId } }),
    db.scene.count({ where: { projectId, assets: { some: { selected: true } } } }),
    db.scene.count({ where: { projectId, voiceover: { isNot: null } } }),
  ]);
  const assetsDone = scenes > 0 && withAsset === scenes;
  const audioDone = scenes > 0 && withVoice === scenes;
  const status = assetsDone && audioDone ? "AUDIO_READY" : assetsDone ? "ASSETS_READY" : "SCRIPT_READY";

  await db.project.update({ where: { id: projectId }, data: { status, failedStage: null } });
}
