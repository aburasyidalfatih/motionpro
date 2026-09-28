-- CreateEnum
CREATE TYPE "VideoStyle" AS ENUM ('GRAPHIC', 'ARCHIVAL');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "style" "VideoStyle" NOT NULL DEFAULT 'GRAPHIC';

-- AlterTable
ALTER TABLE "Scene" ALTER COLUMN "visualType" SET DEFAULT 'kinetic_text';
