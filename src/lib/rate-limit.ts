import { prisma } from "@/lib/prisma";
import { requestRateLimitKey } from "@/lib/request-identity";

export { identityRateLimitKey, requestRateLimitKey, verifiedClientIp, verifiedIpRateLimitKey } from "@/lib/request-identity";

/** Atomic PostgreSQL counter. The key is a keyed hash, not a raw IP or email address. */
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error("INVALID_RATE_LIMIT_CONFIGURATION");
  }
  // PostgreSQL is the single time authority for expiry checks and reset timestamps.
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, clock_timestamp() + (${windowSeconds} * interval '1 second'))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= clock_timestamp() THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= clock_timestamp()
          THEN clock_timestamp() + (${windowSeconds} * interval '1 second')
        ELSE "RateLimitBucket"."resetAt"
      END
    RETURNING "count"
  `;
  return (rows[0]?.count ?? limit + 1) <= limit;
}
