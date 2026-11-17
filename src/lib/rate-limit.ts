import { prisma } from "@/lib/prisma";
import { requestRateLimitKeys } from "@/lib/request-identity";

export { requestRateLimitKeys, verifiedClientIp } from "@/lib/request-identity";

/** Atomic PostgreSQL counter. The key is a keyed hash, not a raw IP or email address. */
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const resetAt = new Date(Date.now() + windowSeconds * 1000);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= NOW() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= NOW() THEN ${resetAt} ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count"
  `;
  return (rows[0]?.count ?? limit + 1) <= limit;
}

/** Charge both independent buckets on every request, even when one is already exhausted. */
export async function consumeRateLimitPair(
  keys: { ipKey: string; identifierKey: string | null },
  ipLimit: number,
  identifierLimit: number,
  windowSeconds: number
) {
  const [ipAllowed, identifierAllowed] = await Promise.all([
    consumeRateLimit(keys.ipKey, ipLimit, windowSeconds),
    keys.identifierKey
      ? consumeRateLimit(keys.identifierKey, identifierLimit, windowSeconds)
      : Promise.resolve(true)
  ]);
  return ipAllowed && identifierAllowed;
}
