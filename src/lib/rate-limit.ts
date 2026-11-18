import { prisma } from "./prisma.ts";
import { requestRateLimitKey } from "./request-identity.ts";

export { identityRateLimitKey, requestRateLimitKey, verifiedClientIp, verifiedIpRateLimitKey } from "./request-identity.ts";

/** Atomic PostgreSQL counter. The key is a keyed hash, not a raw IP or email address. */
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error("INVALID_RATE_LIMIT_CONFIGURATION");
  }
  // PostgreSQL is the single time authority for expiry checks and reset timestamps.
  // Materialize one live-clock sample so the count and resetAt decisions cannot
  // disagree if the window expires between two clock_timestamp() evaluations.
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    WITH db_clock AS MATERIALIZED (
      SELECT clock_timestamp() AS now
    )
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    SELECT ${key}, 1, db_clock.now + (${windowSeconds} * interval '1 second')
    FROM db_clock
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= (SELECT now FROM db_clock) THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= (SELECT now FROM db_clock)
          THEN (SELECT now FROM db_clock) + (${windowSeconds} * interval '1 second')
        ELSE "RateLimitBucket"."resetAt"
      END
    RETURNING "count"
  `;
  return (rows[0]?.count ?? limit + 1) <= limit;
}
