import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { consumeEmailVerificationCode } from "../src/lib/email-verification.ts";

const prisma = new PrismaClient();
after(async () => { await prisma.$disconnect(); });

async function withUser(run, { digest = "correct-digest", expiresAt = new Date(Date.now() + 10 * 60_000), attempts = 0 } = {}) {
  const email = `otp-regression-${randomUUID()}@example.invalid`;
  const user = await prisma.user.create({ data: {
    email, emailVerificationCodeHash: digest, emailVerificationExpiresAt: expiresAt,
    emailVerificationAttempts: attempts
  }});
  try { await run({ email, user, consume: (code = digest) => consumeEmailVerificationCode(prisma, email, code) }); }
  finally { await prisma.user.delete({ where: { id: user.id } }); }
}
async function reload(id) { return prisma.user.findUniqueOrThrow({ where: { id } }); }

test("1. valid, unexpired OTP verifies and is consumed", async () => withUser(async ({ user, consume }) => {
  assert.equal(await consume(), true);
  const row = await reload(user.id);
  assert.ok(row.emailVerified); assert.equal(row.emailVerificationCodeHash, null);
  assert.equal(row.emailVerificationExpiresAt, null); assert.equal(row.emailVerificationAttempts, 0);
}));
test("2. expired OTP is rejected using PostgreSQL live time", async () => withUser(async ({ user, consume }) => {
  assert.equal(await consume(), false);
  const row = await reload(user.id); assert.equal(row.emailVerified, null);
  assert.equal(row.emailVerificationAttempts, 0);
}, { expiresAt: new Date(Date.now() - 11 * 60_000) }));
test("3. a consumed OTP cannot be replayed", async () => withUser(async ({ user, consume }) => {
  assert.equal(await consume(), true); assert.equal(await consume(), false);
  assert.ok((await reload(user.id)).emailVerified);
}));
test("4. concurrent verification of the same OTP has exactly one winner", async () => withUser(async ({ user, consume }) => {
  const results = await Promise.all(Array.from({ length: 12 }, () => consume()));
  assert.equal(results.filter(Boolean).length, 1);
  const row = await reload(user.id); assert.ok(row.emailVerified); assert.equal(row.emailVerificationCodeHash, null);
}));
test("5. incorrect submissions increment the attempt counter exactly once each", async () => withUser(async ({ user, consume }) => {
  for (let expected = 1; expected <= 3; expected++) {
    assert.equal(await consume("wrong-digest"), false);
    assert.equal((await reload(user.id)).emailVerificationAttempts, expected);
  }
}));
test("6. the sixth incorrect attempt is rejected and cannot exceed the limit", async () => withUser(async ({ user, consume }) => {
  for (let i = 0; i < 6; i++) assert.equal(await consume("wrong-digest"), false);
  assert.equal((await reload(user.id)).emailVerificationAttempts, 5);
  assert.equal(await consume(), false); assert.equal((await reload(user.id)).emailVerified, null);
}));
test("7. concurrent incorrect submissions cannot bypass the five-attempt limit", async () => withUser(async ({ user, consume }) => {
  const results = await Promise.all(Array.from({ length: 20 }, () => consume("wrong-digest")));
  assert.ok(results.every(result => result === false));
  assert.equal((await reload(user.id)).emailVerificationAttempts, 5);
}));
test("8. resending replaces the stored digest and invalidates the previous OTP", async () => withUser(async ({ user, consume }) => {
  await prisma.user.update({ where: { id: user.id }, data: {
    emailVerificationCodeHash: "new-digest",
    emailVerificationExpiresAt: new Date(Date.now() + 10 * 60_000),
    emailVerificationAttempts: 0
  }});
  assert.equal(await consume("old-digest"), false);
  assert.equal(await consume("new-digest"), true);
  assert.ok((await reload(user.id)).emailVerified);
}, { digest: "old-digest" }));
test("9. a database error during verification does not partially verify the account", async () => withUser(async ({ user, email }) => {
  const failingStore = { $queryRaw: async () => { throw new Error("simulated database outage"); } };
  await assert.rejects(() => consumeEmailVerificationCode(failingStore, email, "correct-digest"), /simulated database outage/);
  const row = await reload(user.id);
  assert.equal(row.emailVerified, null); assert.equal(row.emailVerificationCodeHash, "correct-digest");
  assert.ok(row.emailVerificationExpiresAt); assert.equal(row.emailVerificationAttempts, 0);
}));
