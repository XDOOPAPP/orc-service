-- CreateTable
CREATE TABLE "OcrJob" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "fileUrl" TEXT NOT NULL,
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "OcrJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OcrJob_userId_status_idx" ON "OcrJob"("userId", "status");
