DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('USER', 'STAFF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "JobWorkMode" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE', 'FLEXIBLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TYPE "JobWorkMode" ADD VALUE IF NOT EXISTS 'FLEXIBLE';
DO $$ BEGIN
  CREATE TYPE "JobPostingStatus" AS ENUM ('ACTIVE', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "ApplicationStatus" AS ENUM ('SAVED', 'PREPARING', 'READY_FOR_REVIEW', 'SUBMITTED', 'INTERVIEW', 'REJECTED', 'OFFER', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL, "name" TEXT, "email" TEXT NOT NULL, "emailVerified" TIMESTAMP(3), "image" TEXT,
  "passwordHash" TEXT, "role" "UserRole" NOT NULL DEFAULT 'USER', "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  "twoFactorMethod" TEXT, "twoFactorEmailCodeHash" TEXT, "twoFactorEmailCodeExpiresAt" TIMESTAMP(3),
  "twoFactorEmailCodeAttempts" INTEGER NOT NULL DEFAULT 0, "twoFactorPendingSecretCipher" TEXT,
  "twoFactorSecretCipher" TEXT, "recoveryCodeHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "emailVerificationCodeHash" TEXT, "emailVerificationExpiresAt" TIMESTAMP(3),
  "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Account" (
  "userId" TEXT NOT NULL, "type" TEXT NOT NULL, "provider" TEXT NOT NULL, "providerAccountId" TEXT NOT NULL,
  "refresh_token" TEXT, "access_token" TEXT, "expires_at" INTEGER, "token_type" TEXT, "scope" TEXT,
  "id_token" TEXT, "session_state" TEXT, CONSTRAINT "Account_pkey" PRIMARY KEY ("provider", "providerAccountId"),
  CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");

CREATE TABLE IF NOT EXISTS "Session" (
  "sessionToken" TEXT NOT NULL, "userId" TEXT NOT NULL, "expires" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("sessionToken"),
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

CREATE TABLE IF NOT EXISTS "VerificationToken" (
  "identifier" TEXT NOT NULL, "token" TEXT NOT NULL, "expires" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier", "token")
);
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "VerificationToken"("token");

CREATE TABLE IF NOT EXISTS "JobProfile" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "headline" TEXT, "location" TEXT NOT NULL DEFAULT 'Anywhere',
  "cvFileKey" TEXT, "skills" TEXT[] NOT NULL, "experienceYears" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JobProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobProfile_userId_key" ON "JobProfile"("userId");

CREATE TABLE IF NOT EXISTS "JobPosting" (
  "id" TEXT NOT NULL, "source" TEXT NOT NULL, "sourceJobId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "company" TEXT NOT NULL, "salaryText" TEXT, "employmentType" TEXT, "jobCategory" TEXT, "description" TEXT,
  "sourceLanguage" TEXT, "applicationUrl" TEXT, "sourceUrl" TEXT, "locationText" TEXT NOT NULL,
  "city" TEXT, "state" TEXT, "country" TEXT, "workMode" "JobWorkMode" NOT NULL DEFAULT 'ONSITE',
  "eligibleLocations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "publishedAt" TIMESTAMP(3),
  "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3),
  "status" "JobPostingStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobPosting_source_sourceJobId_key" ON "JobPosting"("source", "sourceJobId");
CREATE INDEX IF NOT EXISTS "JobPosting_status_publishedAt_idx" ON "JobPosting"("status", "publishedAt");
CREATE INDEX IF NOT EXISTS "JobPosting_city_state_country_idx" ON "JobPosting"("city", "state", "country");
CREATE INDEX IF NOT EXISTS "JobPosting_country_workMode_status_idx" ON "JobPosting"("country", "workMode", "status");
ALTER TABLE "JobPosting" ADD COLUMN IF NOT EXISTS "sourceLanguage" TEXT;
ALTER TABLE "JobPosting" ADD COLUMN IF NOT EXISTS "jobCategory" TEXT;
ALTER TABLE "JobProfile" ALTER COLUMN "location" SET DEFAULT 'Anywhere';

CREATE TABLE IF NOT EXISTS "UserJobPreference" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "preferredCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "preferredRegions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "preferredCities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "preferredWorkModes" "JobWorkMode"[] NOT NULL DEFAULT ARRAY[]::"JobWorkMode"[],
  "employmentTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "jobCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "interfaceLanguage" TEXT NOT NULL DEFAULT 'en', "nativeLanguage" TEXT,
  "jobDescriptionLanguage" TEXT NOT NULL DEFAULT 'en', "applicationLanguage" TEXT NOT NULL DEFAULT 'en',
  "communicationLanguage" TEXT NOT NULL DEFAULT 'en', "additionalLanguages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "worldwideSearch" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserJobPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserJobPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserJobPreference_userId_key" ON "UserJobPreference"("userId");

CREATE TABLE IF NOT EXISTS "SavedJob" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "jobPostingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SavedJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SavedJob_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SavedJob_userId_jobPostingId_key" ON "SavedJob"("userId", "jobPostingId");
CREATE INDEX IF NOT EXISTS "SavedJob_userId_createdAt_idx" ON "SavedJob"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "Application" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "jobPostingId" TEXT, "company" TEXT NOT NULL, "jobTitle" TEXT NOT NULL,
  "jobUrl" TEXT, "workLocation" TEXT NOT NULL, "workMode" TEXT, "source" TEXT, "publishedAt" TIMESTAMP(3),
  "status" "ApplicationStatus" NOT NULL DEFAULT 'SAVED', "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Application_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Application_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Application_userId_jobPostingId_key" ON "Application"("userId", "jobPostingId");
CREATE INDEX IF NOT EXISTS "Application_userId_status_idx" ON "Application"("userId", "status");
CREATE INDEX IF NOT EXISTS "Application_userId_createdAt_idx" ON "Application"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "AuditEvent" (
  "id" TEXT NOT NULL, "userId" TEXT, "action" TEXT NOT NULL, "resource" TEXT, "resourceId" TEXT,
  "ipHash" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AuditEvent_userId_createdAt_idx" ON "AuditEvent"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
  "key" TEXT NOT NULL, "count" INTEGER NOT NULL DEFAULT 0, "resetAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);
CREATE INDEX IF NOT EXISTS "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
