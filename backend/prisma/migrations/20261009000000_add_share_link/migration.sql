-- AlterTable
ALTER TABLE "User" ADD COLUMN     "shareSettings" JSONB,
ADD COLUMN     "shareTokenEnc" TEXT,
ADD COLUMN     "shareTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_shareTokenHash_key" ON "User"("shareTokenHash");
