import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { consumeRateLimit } from "../src/lib/rate-limit.ts";

const prisma = new PrismaClient();

test("concurrent login attempts independently enforce IP and email database counters", async () => {
  const suffix = randomUUID();
  const ipKey = `integration:login:ip:${suffix}`;
  const emailKey = `integration:login:email:${suffix}`;
  const otherIpKey = `integration:login:ip:other:${suffix}`;
  const otherEmailKey = `integration:login:email:other:${suffix}`;

  try {
    const attempts = await Promise.all(Array.from({ length: 30 }, async () => {
      const [ipAllowed, emailAllowed] = await Promise.all([
        consumeRateLimit(ipKey, 20, 900),
        consumeRateLimit(emailKey, 10, 900)
      ]);
      return { ipAllowed, emailAllowed };
    }));

    assert.equal(attempts.filter(result => result.ipAllowed).length, 20,
      "the shared verified-IP counter must allow exactly its own threshold");
    assert.equal(attempts.filter(result => result.emailAllowed).length, 10,
      "the account counter must enforce its lower threshold independently");

    // A different account does not inherit the first account's email bucket.
    assert.equal(await consumeRateLimit(otherEmailKey, 10, 900), true);
    // A different verified IP does not inherit the first IP's bucket.
    assert.equal(await consumeRateLimit(otherIpKey, 20, 900), true);

    const [ipRow, emailRow] = await Promise.all([
      prisma.rateLimitBucket.findUniqueOrThrow({ where: { key: ipKey } }),
      prisma.rateLimitBucket.findUniqueOrThrow({ where: { key: emailKey } })
    ]);
    assert.equal(ipRow.count, 30);
    assert.equal(emailRow.count, 30);
  } finally {
    await prisma.rateLimitBucket.deleteMany({
      where: { key: { in: [ipKey, emailKey, otherIpKey, otherEmailKey] } }
    });
  }
});

test("expired rate-limit buckets reset using PostgreSQL's live clock", async () => {
  const key = `integration:login:expiry:${randomUUID()}`;
  try {
    await prisma.rateLimitBucket.create({
      data: { key, count: 99, resetAt: new Date(Date.now() - 60_000) }
    });
    assert.equal(await consumeRateLimit(key, 10, 900), true);
    const row = await prisma.rateLimitBucket.findUniqueOrThrow({ where: { key } });
    assert.equal(row.count, 1, "expired bucket must restart at one");
    const clock = await prisma.$queryRaw`SELECT clock_timestamp() AS now`;
    assert.ok(row.resetAt > clock[0].now, "new reset time must be in the future according to PostgreSQL");
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { key } });
  }
});
