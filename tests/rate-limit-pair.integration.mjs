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
    assert.equal(results.filter(Boolean).length, 5);
    const row = await prisma.rateLimitBucket.findUniqueOrThrow({ where: { key: ipKey } });
    assert.equal(row.count, 25);
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
