import test from "node:test";
import assert from "node:assert/strict";
import { isSessionVersionCurrent } from "../src/lib/session-security.ts";
import { isVerifiedGoogleEmail } from "../src/lib/oauth-security.ts";
import { requireAuthenticatedUser, requireStaff } from "../src/lib/authorization.ts";

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
