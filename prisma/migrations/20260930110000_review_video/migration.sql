-- Pemeriksaan AI atas frame video hasil render.
ALTER TYPE "JobKind" ADD VALUE 'REVIEW';
ALTER TABLE "Video" ADD COLUMN "review" JSONB;
