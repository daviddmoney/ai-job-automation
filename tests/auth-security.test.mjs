import test from "node:test";
import assert from "node:assert/strict";
import { isSessionVersionCurrent } from "../src/lib/session-security.ts";
import { isVerifiedGoogleEmail } from "../src/lib/oauth-security.ts";
import { requireAuthenticatedUser, requireStaff } from "../src/lib/authorization.ts";
import { passwordResetTokenDigest } from "../src/lib/password-reset.ts";
import { isSameOriginRequest } from "../src/lib/request-security.ts";

test("session versions revoke missing, stale and malformed JWT claims", () => {
  assert.equal(isSessionVersionCurrent(3, 3), true);
  assert.equal(isSessionVersionCurrent(2, 3), false);
  assert.equal(isSessionVersionCurrent(undefined, 0), false);
  assert.equal(isSessionVersionCurrent("3", 3), false);
});

test("Google OAuth accepts only an explicitly verified email claim", () => {
  assert.equal(isVerifiedGoogleEmail({ email_verified: true }), true);
  assert.equal(isVerifiedGoogleEmail({ email_verified: false }), false);
  assert.equal(isVerifiedGoogleEmail({ email: "person@example.test" }), false);
  assert.equal(isVerifiedGoogleEmail(null), false);
});

test("server authorization rejects missing users and ordinary users as staff", () => {
  assert.throws(() => requireAuthenticatedUser(null), /UNAUTHENTICATED/);
  assert.throws(() => requireStaff({ id: "user-1", role: "USER" }), /FORBIDDEN/);
  assert.deepEqual(requireStaff({ id: "staff-1", role: "STAFF" }), { id: "staff-1", role: "STAFF" });
});

test("password reset tokens are HMAC-keyed and token-specific", () => {
  const previous = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "test-secret-with-more-than-thirty-two-characters";
  try {
    assert.equal(passwordResetTokenDigest("token-a").length, 64);
    assert.notEqual(passwordResetTokenDigest("token-a"), passwordResetTokenDigest("token-b"));
  } finally {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  }
});

test("same-origin auth POSTs require HTTPS in production and exact origin matching", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const secure = new Request("https://app.example.test/api/auth", {
      method: "POST",
      headers: { host: "app.example.test", origin: "https://app.example.test" }
    });
    const downgraded = new Request("https://app.example.test/api/auth", {
      method: "POST",
      headers: { host: "app.example.test", origin: "http://app.example.test" }
    });
    const foreign = new Request("https://app.example.test/api/auth", {
      method: "POST",
      headers: { host: "app.example.test", origin: "https://attacker.example" }
    });
    assert.equal(isSameOriginRequest(secure), true);
    assert.equal(isSameOriginRequest(downgraded), false);
    assert.equal(isSameOriginRequest(foreign), false);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
