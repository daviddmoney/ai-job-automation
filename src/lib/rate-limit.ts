import { prisma } from "./prisma.ts";
import { requestRateLimitKey } from "./request-identity.ts";

export { requestRateLimitKey, identifierRateLimitKey, verifiedClientIp } from "./request-identity.ts";

let callsSinceCleanup = 0;
const CLEANUP_EVERY_CALLS = 100;
const CLEANUP_BATCH_SIZE = 500;

/**
 * Delete expired rate-limit buckets in bounded batches. Keep a one-hour grace
 * period so a delayed request cannot unexpectedly recreate a just-expired key.
 * Retain rate-limit audit summaries for 90 days.
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

/** Atomic PostgreSQL counter. Keys are keyed hashes, never raw IPs or emails. */
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
  const count = rows[0]?.count ?? limit + 1;
  if (count > limit && count === limit + 1) {
    // One durable event per bucket/window, without writing on every blocked retry.
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
      console.error(JSON.stringify({ event: "security_audit_write_failed", action: "RATE_LIMIT_DENIED" }));
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
      // Cleanup is best-effort; never fail closed or open the limiter because
      // housekeeping failed. The audit log exposes the operational problem.
      console.error(JSON.stringify({ event: "rate_limit_cleanup_failed", occurredAt: new Date().toISOString() }));
    }
  }
  return count <= limit;
}
