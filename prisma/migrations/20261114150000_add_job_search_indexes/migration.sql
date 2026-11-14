CREATE INDEX IF NOT EXISTS "JobPosting_country_status_city_publishedAt_idx"
ON "JobPosting"("country", "status", "city", "publishedAt");

CREATE INDEX IF NOT EXISTS "JobPosting_country_status_workMode_publishedAt_idx"
ON "JobPosting"("country", "status", "workMode", "publishedAt");
