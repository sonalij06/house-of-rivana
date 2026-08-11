-- Product / hero / review image bytes live in Postgres instead of Supabase Storage.
CREATE TABLE "StoredImage" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoredImage_path_key" ON "StoredImage"("path");
CREATE INDEX "StoredImage_createdAt_idx" ON "StoredImage"("createdAt");