import { prisma } from "./prisma.ts";
import { requestAccountRateLimitKey, requestIpRateLimitKey, requestRateLimitKey } from "./request-identity.ts";

export { requestAccountRateLimitKey, requestIpRateLimitKey, requestRateLimitKey, verifiedClientIp } from "./request-identity.ts";

export type RateLimitDecision = { allowed: boolean; retryAfterSeconds: number };

/** Atomic PostgreSQL counter shared by every application instance using this database. */
export async function consumeRateLimitWithInfo(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
  const resetAt = new Date(Date.now() + windowSeconds * 1000);
  const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= NOW() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= NOW() THEN ${resetAt} ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"
  `;
  const row = rows[0];
  const allowed = (row?.count ?? limit + 1) <= limit;
  const retryAfterSeconds = Math.max(1, Math.ceil(((row?.resetAt?.getTime() ?? Date.now() + windowSeconds * 1000) - Date.now()) / 1000));
  return { allowed, retryAfterSeconds };
}

/** Preserve the original boolean API for verification and other existing callers. */
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  return (await consumeRateLimitWithInfo(key, limit, windowSeconds)).allowed;
}

/**
 * Enforce independent IP-wide and account-wide buckets using the existing table.
 * An unverified client IP fails closed; it is never converted into a shared bucket.
 */
export async function consumeIndependentRateLimits(
  request: Request,
  scope: string,
  identifier: string,
  ipLimit: number,
  accountLimit: number,
  windowSeconds: number
): Promise<RateLimitDecision & { identityVerified: boolean }> {
  const ipKey = requestIpRateLimitKey(request, scope);
  if (!ipKey) return { allowed: false, retryAfterSeconds: 0, identityVerified: false };
  // Malformed or missing identifiers must still consume the IP bucket. Do not
  // let an empty account identifier bypass IP-wide protection or create a
  // shared account bucket that could throttle unrelated valid accounts.
  const accountKey = identifier.trim() ? requestAccountRateLimitKey(scope, identifier) : null;
  const [ip, account] = await Promise.all([
    consumeRateLimitWithInfo(ipKey, ipLimit, windowSeconds),
    accountKey
      ? consumeRateLimitWithInfo(accountKey, accountLimit, windowSeconds)
      : Promise.resolve(null)
  ]);
  return {
    allowed: ip.allowed && (account?.allowed ?? true),
    retryAfterSeconds: Math.max(
      ip.allowed ? 0 : ip.retryAfterSeconds,
      account && !account.allowed ? account.retryAfterSeconds : 0
    ),
    identityVerified: true
  };
}
