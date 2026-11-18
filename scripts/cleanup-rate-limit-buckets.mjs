import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const batchSize = 500;
let totalBuckets = 0;
let totalEvents = 0;

try {
  while (true) {
    const buckets = await prisma.$queryRaw`
      WITH expired AS (
        SELECT "key" FROM "RateLimitBucket"
        WHERE "resetAt" < (clock_timestamp() AT TIME ZONE 'UTC') - INTERVAL '1 hour'
        ORDER BY "resetAt" ASC LIMIT ${batchSize}
      ),
      removed AS (
        DELETE FROM "RateLimitBucket" AS bucket USING expired
        WHERE bucket."key" = expired."key" RETURNING 1
      )
      SELECT COUNT(*)::int AS deleted FROM removed
    `;
    const events = await prisma.$queryRaw`
      WITH stale AS (
        SELECT "id" FROM "AuditEvent"
        WHERE "action" = 'RATE_LIMIT_DENIED'
          AND "createdAt" < (clock_timestamp() AT TIME ZONE 'UTC') - INTERVAL '90 days'
        ORDER BY "createdAt" ASC LIMIT ${batchSize}
      ),
      removed AS (
        DELETE FROM "AuditEvent" AS event USING stale
        WHERE event."id" = stale."id" RETURNING 1
      )
      SELECT COUNT(*)::int AS deleted FROM removed
    `;
    const deletedBuckets = buckets[0]?.deleted ?? 0;
    const deletedEvents = events[0]?.deleted ?? 0;
    totalBuckets += deletedBuckets;
    totalEvents += deletedEvents;
    if (deletedBuckets < batchSize && deletedEvents < batchSize) break;
  }
  console.info(JSON.stringify({
    event: "rate_limit_cleanup_complete",
    deletedBuckets: totalBuckets,
    deletedAuditEvents: totalEvents,
    occurredAt: new Date().toISOString()
  }));
} finally {
  await prisma.$disconnect();
}
