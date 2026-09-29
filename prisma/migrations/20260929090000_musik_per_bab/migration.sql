-- Musik latar berganti mengikuti suasana tiap bab.
ALTER TABLE "Project" ADD COLUMN "musicPerChapter" BOOLEAN NOT NULL DEFAULT true;
