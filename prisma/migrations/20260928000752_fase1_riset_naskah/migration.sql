/*
  Warnings:

  - Added the required column `position` to the `Source` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Scene_projectId_order_key";

-- AlterTable
ALTER TABLE "ResearchBrief" ADD COLUMN     "searchSuggestions" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "position" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Scene_projectId_order_idx" ON "Scene"("projectId", "order");
