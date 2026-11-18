import { prisma } from "./prisma.ts";
import {
  loginRateLimitPassKey,
  requestAccountRateLimitKey,
  requestIpRateLimitKey
} from "./request-identity.ts";

export {
  requestAccountRateLimitKey,
  requestIpRateLimitKey,
  requestRateLimitKey,
  identifierRateLimitKey,
  verifiedClientIp
} from "./request-identity.ts";

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

let callsSinceCleanup = 0;
const CLEANUP_EVERY_CALLS = 100;
const CLEANUP_BATCH_SIZE = 500;

/**
 * Delete expired rate-limit buckets in bounded batches.
 * Keep a one-hour grace period and retain rate-limit audit events for 90 days.
 */
export async function cleanupExpiredRateLimitBuckets(batchSize = CLEANUP_BATCH_SIZE) {
  const bucketRows = await prisma.$queryRaw<Array<{ deleted: number }>>`
    WITH expired AS (
      SELECT "key"
      FROM "RateLimitBucket"
      WHERE "resetAt" < (clock_timestamp() AT TIME ZONE 'UTC') - INTERVAL '1 hour'
      ORDER BY "resetAt" ASC
      LIMIT ${batchSize}
    ),
    removed AS (
      DELETE FROM "RateLimitBucket" AS bucket
      USING expired
      WHERE bucket."key" = expired."key"
      RETURNING 1
    )
    SELECT COUNT(*)::int AS deleted FROM removed
  `;

  const eventRows = await prisma.$queryRaw<Array<{ deleted: number }>>`
    WITH stale AS (
      SELECT "id"
      FROM "AuditEvent"
      WHERE "action" = 'RATE_LIMIT_DENIED'
        AND "createdAt" < (clock_timestamp() AT TIME ZONE 'UTC') - INTERVAL '90 days'
      ORDER BY "createdAt" ASC
      LIMIT ${batchSize}
    ),
    removed AS (
      DELETE FROM "AuditEvent" AS event
      USING stale
      WHERE event."id" = stale."id"
      RETURNING 1
    )
    SELECT COUNT(*)::int AS deleted FROM removed
  `;

  const deletedBuckets = bucketRows[0]?.deleted ?? 0;
  const deletedAuditEvents = eventRows[0]?.deleted ?? 0;

  if (deletedBuckets || deletedAuditEvents) {
    console.info(JSON.stringify({
      event: "rate_limit_cleanup",
      deletedBuckets,
      deletedAuditEvents,
      occurredAt: new Date().toISOString()
    }));
  }

  return { deletedBuckets, deletedAuditEvents };
}

/** Atomic PostgreSQL counter shared by every application instance using this database. */
export async function consumeRateLimitWithInfo(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitDecision> {
  const rows = await prisma.$queryRaw<Array<{ count: number; retryAfterSeconds: number }>>`
    WITH db_clock AS MATERIALIZED (
      SELECT clock_timestamp() AS now
    )
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    SELECT ${key}, 1, db_clock.now + (${windowSeconds} * INTERVAL '1 second')
    FROM db_clock
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= (SELECT now FROM db_clock) THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= (SELECT now FROM db_clock)
          THEN (SELECT now FROM db_clock) + (${windowSeconds} * INTERVAL '1 second')
        ELSE "RateLimitBucket"."resetAt"
      END
    RETURNING
      "count",
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("resetAt" - (SELECT now FROM db_clock)))))::int AS "retryAfterSeconds"
  `;

  const row = rows[0];

  if (row && row.count === limit + 1) {
    // Record only the first denial for this bucket/window.
    try {
      await prisma.auditEvent.create({
        data: {
          action: "RATE_LIMIT_DENIED",
          resource: "RateLimitBucket",
          resourceId: key,
          ipHash: key
        }
      });
    } catch {
      console.error(JSON.stringify({
        event: "security_audit_write_failed",
        action: "RATE_LIMIT_DENIED"
      }));
    }

    console.warn(JSON.stringify({
      event: "security_rate_limit_denied",
      keyFingerprint: key.slice(0, 12),
      limit,
      windowSeconds,
      occurredAt: new Date().toISOString()
    }));
  }

  callsSinceCleanup += 1;
  if (callsSinceCleanup >= CLEANUP_EVERY_CALLS) {
    callsSinceCleanup = 0;
    try {
      await cleanupExpiredRateLimitBuckets();
    } catch {
      // Housekeeping must not change the rate-limit decision.
      console.error(JSON.stringify({
        event: "rate_limit_cleanup_failed",
        occurredAt: new Date().toISOString()
      }));
    }
  }

  return {
    allowed: (row?.count ?? limit + 1) <= limit,
    retryAfterSeconds: Math.max(1, row?.retryAfterSeconds ?? windowSeconds)
  };
}

/** Preserve the original boolean API for existing callers. */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
) {
  return (await consumeRateLimitWithInfo(key, limit, windowSeconds)).allowed;
}

/**
 * Enforce independent IP-wide and account-wide buckets.
 * An unverified client IP fails closed.
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
  if (!ipKey) {
    return { allowed: false, retryAfterSeconds: 0, identityVerified: false };
  }

  // Missing identifiers still consume the IP bucket, but never create
  // a shared account bucket that could throttle unrelated users.
  const accountKey = identifier.trim()
    ? requestAccountRateLimitKey(scope, identifier)
    : null;

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
export async function consumeLoginRateLimitPass(
  request: Request,
  identifier: string
): Promise<boolean | null> {
  const key = loginRateLimitPassKey(request, identifier);
  if (!key) return null;
  return (await consumeRateLimitWithInfo(key, 1, 30)).allowed;
}

/** Shared credentials-login endpoint gate for callback and server action paths. */
export async function consumeCredentialsLoginEndpointLimit(
  request: Request,
  identifier: string
) {
  return consumeIndependentRateLimits(
    request, "login", identifier, 30, 10, 15 * 60
  );
}

/** IP-only gate for OAuth initiation, before the user's account is known. */
export async function consumeOAuthInitiationEndpointLimit(request: Request) {
  return consumeIndependentRateLimits(
    request, "oauth-login", "", 30, 1, 15 * 60
  );
}
