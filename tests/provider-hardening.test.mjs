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
