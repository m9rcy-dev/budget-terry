-- CreateTable
CREATE TABLE "device_trusts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_trusts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_trusts_tokenHash_key" ON "device_trusts"("tokenHash");

-- CreateIndex
CREATE INDEX "device_trusts_userId_idx" ON "device_trusts"("userId");

-- AddForeignKey
ALTER TABLE "device_trusts" ADD CONSTRAINT "device_trusts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
