import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { consumeRateLimitPair } from "../src/lib/rate-limit.ts";

const prisma = new PrismaClient();
after(async () => { await prisma.$disconnect(); });

test("concurrent requests cannot exceed the shared IP and account limits", async () => {
  const ipKey = `test-ip-${randomUUID()}`;
  const identifierKey = `test-account-${randomUUID()}`;
  try {
    const results = await Promise.all(Array.from({ length: 25 }, () =>
      consumeRateLimitPair({ ipKey, identifierKey }, 5, 5, 600)
    ));
    // The two independent counters are charged concurrently. Under contention,
    // their per-key serialization order can differ, so the intersection of the
    // first five admitted requests may be smaller than five. It must never be
    // greater than either configured limit, and every request must hit both buckets.
    const allowed = results.filter(Boolean).length;
    assert.ok(allowed <= 5, `expected no more than 5 admitted requests, received ${allowed}`);
    const [ipRow, accountRow] = await Promise.all([
      prisma.rateLimitBucket.findUniqueOrThrow({ where: { key: ipKey } }),
      prisma.rateLimitBucket.findUniqueOrThrow({ where: { key: identifierKey } })
    ]);
    assert.equal(ipRow.count, 25, "all requests must increment the IP bucket");
    assert.equal(accountRow.count, 25, "all requests must increment the account bucket");
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { in: [ipKey, identifierKey] } } });
  }
});

test("account limits remain independent while requests share an IP bucket", async () => {
  const ipKey = `test-shared-ip-${randomUUID()}`;
  const accountA = `test-account-a-${randomUUID()}`;
  const accountB = `test-account-b-${randomUUID()}`;
  try {
    const [a, b] = await Promise.all([
      Promise.all(Array.from({ length: 8 }, () => consumeRateLimitPair({ ipKey, identifierKey: accountA }, 20, 5, 600))),
      Promise.all(Array.from({ length: 8 }, () => consumeRateLimitPair({ ipKey, identifierKey: accountB }, 20, 5, 600)))
    ]);
    assert.equal(a.filter(Boolean).length, 5);
    assert.equal(b.filter(Boolean).length, 5);
    const ipRow = await prisma.rateLimitBucket.findUniqueOrThrow({ where: { key: ipKey } });
    assert.equal(ipRow.count, 16);
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { in: [ipKey, accountA, accountB] } } });
  }
});
