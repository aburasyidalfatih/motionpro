// Hasil pemeriksaan AI atas video hasil render (Video.review, job REVIEW).
export type VideoReview = {
  checkedAt: string;
  issues: { scene: number; timeMs: number; severity: string; problem: string; fix: string }[];
};
