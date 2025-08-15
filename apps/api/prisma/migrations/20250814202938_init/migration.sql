-- CreateTable
CREATE TABLE "works" (
    "id" TEXT NOT NULL,
    "doi" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "acceptedDate" TIMESTAMP(3),
    "batch" TEXT NOT NULL,
    "server" TEXT NOT NULL DEFAULT 'biorxiv',
    "s3Bucket" TEXT NOT NULL DEFAULT 'biorxiv-src-monthly',
    "s3Key" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "works_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "works_doi_version_idx" ON "works"("doi", "version");

-- CreateIndex
CREATE INDEX "works_receivedDate_idx" ON "works"("receivedDate");

-- CreateIndex
CREATE INDEX "works_acceptedDate_idx" ON "works"("acceptedDate");

-- CreateIndex
CREATE INDEX "works_batch_idx" ON "works"("batch");

-- CreateIndex
CREATE INDEX "works_server_idx" ON "works"("server");

-- CreateIndex
CREATE UNIQUE INDEX "works_doi_version_key" ON "works"("doi", "version");
