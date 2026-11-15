CREATE TABLE "CvDocument" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "content" BYTEA NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CvDocument_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GmailConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "googleEmail" TEXT NOT NULL,
  "accessTokenCipher" TEXT NOT NULL,
  "refreshTokenCipher" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GmailConnection_userId_key" ON "GmailConnection"("userId");
CREATE INDEX "CvDocument_userId_isPrimary_updatedAt_idx" ON "CvDocument"("userId","isPrimary","updatedAt");
ALTER TABLE "CvDocument" ADD CONSTRAINT "CvDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmailConnection" ADD CONSTRAINT "GmailConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
