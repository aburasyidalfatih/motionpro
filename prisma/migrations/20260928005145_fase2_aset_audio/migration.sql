-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "pageUrl" TEXT,
ADD COLUMN     "previewUrl" TEXT,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "musicTrack" TEXT,
ADD COLUMN     "voiceStyle" TEXT;
