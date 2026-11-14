ALTER TYPE "JobWorkMode" ADD VALUE IF NOT EXISTS 'FLEXIBLE';
ALTER TABLE "JobProfile" ALTER COLUMN "location" SET DEFAULT 'Anywhere';
ALTER TABLE "JobPosting" ADD COLUMN IF NOT EXISTS "sourceLanguage" TEXT;
CREATE TABLE IF NOT EXISTS "UserJobPreference" (
 "id" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "preferredCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "preferredRegions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "preferredCities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "preferredWorkModes" "JobWorkMode"[] NOT NULL DEFAULT ARRAY[]::"JobWorkMode"[],
 "employmentTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "jobCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "interfaceLanguage" TEXT NOT NULL DEFAULT 'en',
 "nativeLanguage" TEXT,
 "jobDescriptionLanguage" TEXT NOT NULL DEFAULT 'en',
 "applicationLanguage" TEXT NOT NULL DEFAULT 'en',
 "communicationLanguage" TEXT NOT NULL DEFAULT 'en',
 "additionalLanguages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "worldwideSearch" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "UserJobPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserJobPreference_userId_key" ON "UserJobPreference"("userId");
CREATE INDEX IF NOT EXISTS "JobPosting_country_workMode_status_idx" ON "JobPosting"("country", "workMode", "status");
ALTER TABLE "UserJobPreference" ADD CONSTRAINT "UserJobPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;