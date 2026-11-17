import test from "node:test";
import assert from "node:assert/strict";
import { fetchBoardJson, employerName, explicitRemoteEligibility } from "../src/lib/jobs/sources/board-utils.ts";
import { isSupportedTranslationLanguage } from "../src/lib/translation/index.ts";

test("board request retries transient provider errors then succeeds", async () => {
 const original = globalThis.fetch;
 let calls = 0;
 globalThis.fetch = async () => {
  calls++;
  if (calls < 3) return new Response("temporary failure", { status: 503 });
  return new Response(JSON.stringify({ jobs: [] }), { status: 200, headers: { "content-type": "application/json" } });
 };
 try {
  const result = await fetchBoardJson("https://example.invalid/board");
  assert.deepEqual(result, { jobs: [] });
  assert.equal(calls, 3);
 } finally { globalThis.fetch = original; }
});

test("board request does not retry permanent 404 responses", async () => {
 const original = globalThis.fetch;
 let calls = 0;
 globalThis.fetch = async () => { calls++; return new Response("not found", { status: 404 }); };
 try { await assert.rejects(() => fetchBoardJson("https://example.invalid/missing"), /HTTP_404/); assert.equal(calls, 1); }
 finally { globalThis.fetch = original; }
});

test("employer names never fall back to technical board slugs", () => {
 const old = process.env.JOB_BOARD_EMPLOYER_NAMES;
 delete process.env.JOB_BOARD_EMPLOYER_NAMES;
 assert.equal(employerName("greenhouse", "acme-board"), null);
 process.env.JOB_BOARD_EMPLOYER_NAMES = JSON.stringify({ "greenhouse:acme-board": "Acme Limited" });
 assert.equal(employerName("greenhouse", "acme-board"), "Acme Limited");
 if (old === undefined) delete process.env.JOB_BOARD_EMPLOYER_NAMES; else process.env.JOB_BOARD_EMPLOYER_NAMES = old;
});

test("remote eligibility preserves only explicit provider-supplied locations", () => {
 assert.deepEqual(explicitRemoteEligibility(["Nigeria", "United Kingdom", "", 7, "Nigeria"]), ["Nigeria", "United Kingdom"]);
 assert.deepEqual(explicitRemoteEligibility("Worldwide"), []);
});

test("translation languages are checked against the supported language list", () => {
 assert.equal(isSupportedTranslationLanguage("en"), true);
 assert.equal(isSupportedTranslationLanguage("pt-BR"), true);
 assert.equal(isSupportedTranslationLanguage("made-up-language"), false);
});


import { withJobSyncLeaseGuard } from "../src/lib/jobs/sources/lease-guard.ts";

test("a worker that loses its lease cannot write another job posting", async () => {
 let writes = 0;
 await assert.rejects(
  () => withJobSyncLeaseGuard(async () => { throw new Error("JobSyncLeaseLost"); }, async () => { writes++; }),
  /JobSyncLeaseLost/
 );
 assert.equal(writes, 0);
});

test("job ingestion checks lease ownership before every individual write", async () => {
 let checks = 0;
 let writes = 0;
 const guardedWrite = () => withJobSyncLeaseGuard(async () => {
  checks++;
  if (checks === 2) throw new Error("JobSyncLeaseLost");
 }, async () => { writes++; });
 await guardedWrite();
 await assert.rejects(() => guardedWrite(), /JobSyncLeaseLost/);
 assert.equal(checks, 2);
 assert.equal(writes, 1);
});

import { verifyTotpCounter, verifyTotp } from "../src/lib/two-factor.ts";

test("TOTP verifier returns the accepted time counter for atomic replay protection", () => {
  // RFC 6238 SHA-1 test secret; at Unix time 59s the six-digit code is 287082.
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(verifyTotpCounter(secret, "287082", 59_000), 1);
  assert.equal(verifyTotp(secret, "287082", 59_000), true);
  assert.equal(verifyTotpCounter(secret, "000000", 59_000), null);
});

import { readLimitedJson, readLimitedFormData } from "../src/lib/request-body.ts";

test("JSON body reader rejects oversized declared bodies before reading", async () => {
  const request = new Request("https://example.invalid/api", {
    method: "POST", headers: { "content-type": "application/json", "content-length": "9999" }, body: "{}"
  });
  const result = await readLimitedJson(request, 32);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 413);
});

test("JSON body reader enforces streamed byte limits and content type", async () => {
  const tooLarge = new Request("https://example.invalid/api", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: "x".repeat(100) })
  });
  const result = await readLimitedJson(tooLarge, 32);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 413);
  const wrongType = new Request("https://example.invalid/api", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  const rejected = await readLimitedJson(wrongType, 32);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.status, 415);
});


test("multipart body reader preserves a bounded PDF upload", async () => {
  const form = new FormData();
  form.append("file", new Blob([Buffer.from("%PDF-1.7")], { type: "application/pdf" }), "cv.pdf");
  const request = new Request("https://example.invalid/api/cv", { method: "POST", body: form });
  const result = await readLimitedFormData(request, 4096);
  assert.equal(result.ok, true);
  if (result.ok) {
    const file = result.data.get("file");
    assert.ok(file instanceof File);
    assert.equal(file.size, 8);
    assert.equal(file.type, "application/pdf");
  }
});

test("multipart body reader rejects oversized streamed bodies and wrong content types", async () => {
  const form = new FormData();
  form.append("file", new Blob([Buffer.alloc(2048, 0x41)], { type: "application/pdf" }), "large.pdf");
  const request = new Request("https://example.invalid/api/cv", { method: "POST", body: form });
  const tooLarge = await readLimitedFormData(request, 1024);
  assert.equal(tooLarge.ok, false);
  if (!tooLarge.ok) assert.equal(tooLarge.status, 413);

  const wrongType = new Request("https://example.invalid/api/cv", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}"
  });
  const rejected = await readLimitedFormData(wrongType, 1024);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.status, 415);
});


import { JoobleNigeriaAdapter } from "../src/lib/jobs/sources/jooble-ng.ts";

test("Jooble reports each keyword target independently when some searches fail", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.JOOBLE_NG_API_KEY;
  process.env.JOOBLE_NG_API_KEY = "test-only-key";
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (body.keywords === "audit") return new Response("provider error", { status: 400 });
    return new Response(JSON.stringify({ jobs: [] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const adapter = new JoobleNigeriaAdapter();
    const jobs = await adapter.fetchRecentJobs({ since: new Date(0) });
    assert.deepEqual(jobs, []);
    assert.equal(adapter.lastRunReport.length, 6);
    assert.equal(adapter.lastRunReport.filter(item => item.status === "succeeded").length, 5);
    assert.equal(adapter.lastRunReport.filter(item => item.status === "failed").length, 1);
    assert.equal(adapter.lastRunReport.find(item => item.target === "audit")?.status, "failed");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.JOOBLE_NG_API_KEY;
    else process.env.JOOBLE_NG_API_KEY = previousKey;
  }
});

test("Jooble preserves a complete all-failed keyword report without hiding failures", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.JOOBLE_NG_API_KEY;
  process.env.JOOBLE_NG_API_KEY = "test-only-key";
  globalThis.fetch = async () => new Response("provider unavailable", { status: 400 });
  try {
    const adapter = new JoobleNigeriaAdapter();
    const jobs = await adapter.fetchRecentJobs({ since: new Date(0) });
    assert.deepEqual(jobs, []);
    assert.equal(adapter.lastRunReport.length, 6);
    assert.equal(adapter.lastRunReport.every(item => item.status === "failed"), true);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.JOOBLE_NG_API_KEY;
    else process.env.JOOBLE_NG_API_KEY = previousKey;
  }
});


import { requestRateLimitKey, verifiedClientIp } from "../src/lib/request-identity.ts";

test("rate limiting ignores client-spoofed forwarding headers without a valid edge token", () => {
  const previousSecret = process.env.TRUSTED_PROXY_HEADER_SECRET;
  process.env.TRUSTED_PROXY_HEADER_SECRET = "trusted-edge-test-secret-that-is-long-enough";
  const spoofed = new Request("https://example.invalid/api", {
    headers: {
      "x-forwarded-for": "198.51.100.77",
      "x-real-ip": "198.51.100.77",
      "x-verified-client-ip": "203.0.113.99",
      "x-trusted-proxy-token": "client-controlled-wrong-token"
    }
  });
  const noToken = new Request("https://example.invalid/api", {
    headers: { "x-verified-client-ip": "203.0.113.99" }
  });
  try {
    assert.equal(verifiedClientIp(spoofed), null);
    assert.equal(verifiedClientIp(noToken), null);
    assert.equal(verifiedClientIp(new Request("https://example.invalid/api", {
      headers: { "x-verified-client-ip": "not-an-ip", "x-trusted-proxy-token": process.env.TRUSTED_PROXY_HEADER_SECRET }
    })), null);
  } finally {
    if (previousSecret === undefined) delete process.env.TRUSTED_PROXY_HEADER_SECRET;
    else process.env.TRUSTED_PROXY_HEADER_SECRET = previousSecret;
  }
});

test("rate limiting accepts valid authenticated IPv4/IPv6 edge identity and hashes it", () => {
  const previousSecret = process.env.TRUSTED_PROXY_HEADER_SECRET;
  const previousAuthSecret = process.env.AUTH_SECRET;
  process.env.TRUSTED_PROXY_HEADER_SECRET = "trusted-edge-test-secret-that-is-long-enough";
  process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters-long";
  const token = process.env.TRUSTED_PROXY_HEADER_SECRET;
  try {
    const ipv4 = new Request("https://example.invalid/api", {
      headers: { "x-verified-client-ip": "203.0.113.10", "x-trusted-proxy-token": token }
    });
    const ipv6 = new Request("https://example.invalid/api", {
      headers: { "x-verified-client-ip": "2001:db8::1", "x-trusted-proxy-token": token }
    });
    assert.equal(verifiedClientIp(ipv4), "203.0.113.10");
    assert.equal(verifiedClientIp(ipv6), "2001:db8::1");
    const first = requestRateLimitKey(ipv4, "login", "user@example.invalid");
    const second = requestRateLimitKey(ipv4, "login", "user@example.invalid");
    const otherIp = requestRateLimitKey(ipv6, "login", "user@example.invalid");
    assert.equal(first, second);
    assert.notEqual(first, otherIp);
    assert.equal(/203\.0\.113\.10|2001:db8::1/.test(first), false);
  } finally {
    if (previousSecret === undefined) delete process.env.TRUSTED_PROXY_HEADER_SECRET;
    else process.env.TRUSTED_PROXY_HEADER_SECRET = previousSecret;
    if (previousAuthSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousAuthSecret;
  }
});
