import { prisma } from "./prisma.ts";
import { loginRateLimitPassKey, requestAccountRateLimitKey, requestIpRateLimitKey, requestRateLimitKey } from "./request-identity.ts";

export { requestAccountRateLimitKey, requestIpRateLimitKey, requestRateLimitKey, verifiedClientIp } from "./request-identity.ts";

export type RateLimitDecision = { allowed: boolean; retryAfterSeconds: number };

/** Atomic PostgreSQL counter shared by every application instance using this database. */
export async function consumeRateLimitWithInfo(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
  const rows = await prisma.$queryRaw<Array<{ count: number; retryAfterSeconds: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, clock_timestamp() + (${windowSeconds} * INTERVAL '1 second'))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= clock_timestamp() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= clock_timestamp()
          THEN clock_timestamp() + (${windowSeconds} * INTERVAL '1 second')
        ELSE "RateLimitBucket"."resetAt"
      END
    RETURNING
      "count",
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("resetAt" - clock_timestamp()))))::int AS "retryAfterSeconds"
  `;
  const row = rows[0];
  return {
    allowed: (row?.count ?? limit + 1) <= limit,
    retryAfterSeconds: Math.max(1, row?.retryAfterSeconds ?? windowSeconds)
  };
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


/** Consume a valid signed callback marker exactly once. Null means invalid/missing. */
export async function consumeLoginRateLimitPass(request: Request, identifier: string): Promise<boolean | null> {
  const key = loginRateLimitPassKey(request, identifier);
  if (!key) return null;
  return (await consumeRateLimitWithInfo(key, 1, 30)).allowed;
}

/** Shared credentials-login endpoint gate used by both callback and server action paths. */
export async function consumeCredentialsLoginEndpointLimit(request: Request, identifier: string) {
  return consumeIndependentRateLimits(request, "login", identifier, 30, 10, 15 * 60);
}

/** IP-only gate for OAuth initiation, where the user's account is not yet known. */
export async function consumeOAuthInitiationEndpointLimit(request: Request) {
  return consumeIndependentRateLimits(request, "oauth-login", "", 30, 1, 15 * 60);
}
