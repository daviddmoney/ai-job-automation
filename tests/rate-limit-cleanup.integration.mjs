import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { cleanupExpiredRateLimitBuckets, consumeRateLimit } from "../src/lib/rate-limit.ts";

const databaseUrl = process.env.DATABASE_URL;

test("rate-limit buckets are cleaned and denials are audited once per window", {
  skip: !databaseUrl ? "DATABASE_URL is required for PostgreSQL integration tests" : false
}, async () => {
  const prisma = new PrismaClient();
  const expiredKey = `expired-${randomUUID()}`;
  const activeKey = `active-${randomUUID()}`;
  const denialKey = `denial-${randomUUID()}`;
  const staleEventId = `stale-${randomUUID()}`;

  try {
    await prisma.rateLimitBucket.createMany({ data: [
      { key: expiredKey, count: 4, resetAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      { key: activeKey, count: 1, resetAt: new Date(Date.now() + 60 * 60 * 1000) }
    ] });
    await prisma.auditEvent.create({
      data: {
        id: staleEventId,
        action: "RATE_LIMIT_DENIED",
        resource: "RateLimitBucket",
        resourceId: staleEventId,
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
      }
    });

    const first = await consumeRateLimit(denialKey, 1, 600);
    const second = await consumeRateLimit(denialKey, 1, 600);
    const third = await consumeRateLimit(denialKey, 1, 600);
    assert.equal(first, true);
    assert.equal(second, false);
    assert.equal(third, false);
    assert.equal(await prisma.auditEvent.count({ where: { action: "RATE_LIMIT_DENIED", resourceId: denialKey } }), 1);

    const cleaned = await cleanupExpiredRateLimitBuckets(500);
    assert.ok(cleaned.deletedBuckets >= 1);
    assert.ok(cleaned.deletedAuditEvents >= 1);
    assert.equal(await prisma.rateLimitBucket.findUnique({ where: { key: expiredKey } }), null);
    assert.ok(await prisma.rateLimitBucket.findUnique({ where: { key: activeKey } }));
    assert.equal(await prisma.auditEvent.findUnique({ where: { id: staleEventId } }), null);
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { in: [expiredKey, activeKey, denialKey] } } });
    await prisma.auditEvent.deleteMany({ where: { resourceId: { in: [denialKey, staleEventId] } } });
    await prisma.$disconnect();
  }
});
