import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../src/app/register/page.tsx", import.meta.url), "utf8");
const verifyPage = await readFile(new URL("../src/app/verify-email/page.tsx", import.meta.url), "utf8");

test("registration form uses an explicit submit handler, not a resetting form action", () => {
  assert.match(page, /<form\s+onSubmit=\{handleSubmit\}/);
  assert.doesNotMatch(page, /<form\s+action=/);
  assert.match(page, /event\.preventDefault\(\)/);
});

test("registration form reports non-2xx responses and preserves fields on failure", () => {
  assert.match(page, /if \(!response\.ok\)/);
  assert.match(page, /setFeedback\(\{\s*kind: "error"/);
  assert.match(page, /finally \{\s*setBusy\(false\)/);
  assert.match(page, /role=\{feedback\.kind === "error" \? "alert" : "status"\}/);
  assert.doesNotMatch(page, /form\.reset\(/);
});

test("registration UI respects rate-limit retry guidance without changing server controls", () => {
  assert.match(page, /response\.status === 429/);
  assert.match(page, /response\.headers\.get\("Retry-After"\)/);
  assert.match(page, /credentials: "same-origin"/);
  assert.match(page, /cache: "no-store"/);
});

test("email verification and resend forms do not use resetting form actions", () => {
  assert.match(verifyPage, /<form\s+onSubmit=\{handleVerify\}/);
  assert.match(verifyPage, /<form\s+onSubmit=\{handleResend\}/);
  assert.doesNotMatch(verifyPage, /<form\s+action=/);
  assert.match(verifyPage, /event\.preventDefault\(\)/);
});

test("email verification UI distinguishes API failures and exposes accessible feedback", () => {
  assert.match(verifyPage, /if \(!response\.ok\)/);
  assert.match(verifyPage, /role=\{feedback\.kind === "error" \? "alert" : "status"\}/);
  assert.match(verifyPage, /response\.status === 429/);
  assert.doesNotMatch(verifyPage, /form\.reset\(/);
});
