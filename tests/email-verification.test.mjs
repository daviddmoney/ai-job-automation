import test from "node:test";
import assert from "node:assert/strict";
import { consumeEmailVerificationCode } from "../src/lib/email-verification.ts";

class MemoryUserStore {
  constructor({ digest = "correct", expiresAt = new Date(Date.now() + 60_000), attempts = 0 } = {}) {
    this.state = { email: "otp@example.invalid", emailVerified: null, emailVerificationCodeHash: digest, emailVerificationExpiresAt: expiresAt, emailVerificationAttempts: attempts };
    this.tail = Promise.resolve(); this.calls = 0; this.failOnCall = null;
  }
  updateMany({ where, data }) {
    const operation = this.tail.then(() => {
      this.calls += 1;
      if (this.failOnCall === this.calls) throw new Error("simulated database failure");
      const s = this.state;
      const hashMatches = typeof where.emailVerificationCodeHash === "string"
        ? s.emailVerificationCodeHash === where.emailVerificationCodeHash
        : where.emailVerificationCodeHash?.not !== undefined ? s.emailVerificationCodeHash !== where.emailVerificationCodeHash.not : true;
      const matches = s.email === where.email && s.emailVerified === where.emailVerified && hashMatches
        && s.emailVerificationExpiresAt instanceof Date && s.emailVerificationExpiresAt > where.emailVerificationExpiresAt.gt
        && s.emailVerificationAttempts < where.emailVerificationAttempts.lt;
      if (!matches) return { count: 0 };
      if (data.emailVerified !== undefined) s.emailVerified = data.emailVerified;
      if (data.emailVerificationCodeHash === null) s.emailVerificationCodeHash = null;
      if (data.emailVerificationExpiresAt === null) s.emailVerificationExpiresAt = null;
      if (typeof data.emailVerificationAttempts === "number") s.emailVerificationAttempts = data.emailVerificationAttempts;
      else if (data.emailVerificationAttempts?.increment) s.emailVerificationAttempts += data.emailVerificationAttempts.increment;
      return { count: 1 };
    });
    this.tail = operation.catch(() => {}); return operation;
  }
}
const consume = (store, digest = "correct") => consumeEmailVerificationCode(store, "otp@example.invalid", digest);

test("1. valid, unexpired OTP verifies and is consumed", async () => {
  const store = new MemoryUserStore();
  assert.equal(await consume(store), true); assert.ok(store.state.emailVerified instanceof Date);
  assert.equal(store.state.emailVerificationCodeHash, null); assert.equal(store.state.emailVerificationExpiresAt, null);
  assert.equal(store.state.emailVerificationAttempts, 0);
});
test("2. expired OTP is rejected using trusted server time, with no client-time parameter", async () => {
  assert.equal(consumeEmailVerificationCode.length, 3, "verification must not accept a caller-supplied clock");
  const store = new MemoryUserStore({ expiresAt: new Date(Date.now() - 11 * 60_000) });
  assert.equal(await consume(store), false); assert.equal(store.state.emailVerified, null);
  assert.equal(store.state.emailVerificationAttempts, 0);
});
test("3. consumed OTP cannot be replayed", async () => {
  const store = new MemoryUserStore(); assert.equal(await consume(store), true);
  assert.equal(await consume(store), false); assert.ok(store.state.emailVerified instanceof Date);
});
test("4. simultaneous verification of one OTP has exactly one winner", async () => {
  const store = new MemoryUserStore();
  const results = await Promise.all(Array.from({ length: 12 }, () => consume(store)));
  assert.equal(results.filter(Boolean).length, 1); assert.ok(store.state.emailVerified instanceof Date);
});
test("5. each incorrect submission increments the attempt counter once", async () => {
  const store = new MemoryUserStore();
  for (let expected = 1; expected <= 3; expected += 1) {
    assert.equal(await consume(store, "wrong"), false); assert.equal(store.state.emailVerificationAttempts, expected);
  }
});
test("6. the sixth incorrect submission cannot bypass the five-attempt limit", async () => {
  const store = new MemoryUserStore();
  for (let i = 0; i < 6; i += 1) assert.equal(await consume(store, "wrong"), false);
  assert.equal(store.state.emailVerificationAttempts, 5); assert.equal(await consume(store), false);
  assert.equal(store.state.emailVerified, null);
});
test("7. concurrent incorrect submissions cannot exceed the five-attempt limit", async () => {
  const store = new MemoryUserStore();
  const results = await Promise.all(Array.from({ length: 20 }, () => consume(store, "wrong")));
  assert.ok(results.every(result => result === false)); assert.equal(store.state.emailVerificationAttempts, 5);
});
test("8. a newly issued OTP invalidates the previously issued OTP", async () => {
  const store = new MemoryUserStore({ digest: "old-digest" }); store.state.emailVerificationCodeHash = "new-digest";
  assert.equal(await consume(store, "old-digest"), false); assert.equal(store.state.emailVerificationAttempts, 1);
  assert.equal(await consume(store, "new-digest"), true);
});
test("9. database failure leaves the account unverified and OTP unconsumed", async () => {
  const store = new MemoryUserStore(); store.failOnCall = 1;
  await assert.rejects(() => consume(store), /simulated database failure/);
  assert.equal(store.state.emailVerified, null); assert.equal(store.state.emailVerificationCodeHash, "correct");
  assert.ok(store.state.emailVerificationExpiresAt instanceof Date); assert.equal(store.state.emailVerificationAttempts, 0);
});
