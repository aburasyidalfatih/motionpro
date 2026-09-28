import { db } from "@/lib/db";

// Status tahap aset dan audio dihitung dari datanya: semua adegan punya aset
// terpilih → ASSETS_READY; ditambah semua adegan punya voice over → AUDIO_READY.
// Dipanggil setelah job aset/audio dan setelah adegan diubah.
export async function recomputeStatus(projectId: string) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const inAssetAudioStage =
    ["SCRIPT_READY", "ASSETS_READY", "AUDIO_READY"].includes(project.status) ||
    (project.status === "FAILED" && (project.failedStage === "ASSETS" || project.failedStage === "AUDIO"));
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
