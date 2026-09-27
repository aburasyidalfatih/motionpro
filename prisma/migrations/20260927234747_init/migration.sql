-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'RESEARCH_READY', 'SCRIPT_READY', 'ASSETS_READY', 'AUDIO_READY', 'RENDERING', 'RENDERED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProjectMode" AS ENUM ('EDITOR', 'AUTO');

-- CreateEnum
CREATE TYPE "AspectRatio" AS ENUM ('LANDSCAPE_16_9', 'PORTRAIT_9_16');

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('PING', 'RESEARCH', 'SCRIPT', 'ASSETS', 'AUDIO', 'RENDER', 'PUBLISH');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "SourceOrigin" AS ENUM ('SEARCH', 'USER');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'VIDEO', 'MUSIC', 'SFX');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('QUEUED', 'UPLOADING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "Privacy" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "targetMinutes" INTEGER NOT NULL DEFAULT 10,
    "language" TEXT NOT NULL DEFAULT 'id',
    "tone" TEXT NOT NULL DEFAULT 'dokumenter',
    "templateId" TEXT NOT NULL DEFAULT 'sejarah-peta',
    "voiceId" TEXT,
    "aspectRatio" "AspectRatio" NOT NULL DEFAULT 'LANDSCAPE_16_9',
    "mode" "ProjectMode" NOT NULL DEFAULT 'EDITOR',
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "failedStage" "JobKind",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchBrief" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "facts" JSONB NOT NULL DEFAULT '[]',
    "timeline" JSONB NOT NULL DEFAULT '[]',
    "hooks" JSONB NOT NULL DEFAULT '[]',
    "markdown" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "origin" "SourceOrigin" NOT NULL DEFAULT 'SEARCH',
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "narration" TEXT NOT NULL,
    "onScreenText" TEXT,
    "keywords" TEXT[],
    "visualType" TEXT NOT NULL DEFAULT 'image',
    "mood" TEXT,
    "durationMs" INTEGER,
    "mapData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT,
    "originalUrl" TEXT,
    "localPath" TEXT,
    "author" TEXT,
    "license" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneAsset" (
    "sceneId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "selected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SceneAsset_pkey" PRIMARY KEY ("sceneId","assetId")
);

-- CreateTable
CREATE TABLE "Voiceover" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "audioPath" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "voiceId" TEXT NOT NULL,
    "wordTimestamps" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voiceover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "kind" "JobKind" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB,
    "result" JSONB,
    "error" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobRunId" TEXT,
    "storageKey" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "srtKey" TEXT,
    "durationMs" INTEGER NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fps" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeChannel" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YoutubeChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeUpload" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "youtubeVideoId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tags" TEXT[],
    "privacy" "Privacy" NOT NULL DEFAULT 'PRIVATE',
    "publishAt" TIMESTAMP(3),
    "status" "UploadStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchBrief_projectId_key" ON "ResearchBrief"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Scene_projectId_order_key" ON "Scene"("projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_provider_providerId_key" ON "Asset"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Voiceover_sceneId_key" ON "Voiceover"("sceneId");

-- CreateIndex
CREATE INDEX "JobRun_projectId_kind_idx" ON "JobRun"("projectId", "kind");

-- CreateIndex
CREATE INDEX "JobRun_createdAt_idx" ON "JobRun"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Video_jobRunId_key" ON "Video"("jobRunId");

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeChannel_channelId_key" ON "YoutubeChannel"("channelId");

-- AddForeignKey
ALTER TABLE "ResearchBrief" ADD CONSTRAINT "ResearchBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ResearchBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneAsset" ADD CONSTRAINT "SceneAsset_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneAsset" ADD CONSTRAINT "SceneAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voiceover" ADD CONSTRAINT "Voiceover_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_jobRunId_fkey" FOREIGN KEY ("jobRunId") REFERENCES "JobRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YoutubeUpload" ADD CONSTRAINT "YoutubeUpload_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YoutubeUpload" ADD CONSTRAINT "YoutubeUpload_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "YoutubeChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
