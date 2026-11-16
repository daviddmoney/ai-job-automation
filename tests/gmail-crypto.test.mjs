import test from "node:test";
import assert from "node:assert/strict";
import { encryptGmailData, decryptGmailData } from "../src/lib/gmail-crypto.ts";
import { encryptTotpSecret, decryptTotpSecret } from "../src/lib/two-factor.ts";

test("Gmail data uses a domain-separated key and remains backward compatible", () => {
  const previous = process.env.TOTP_ENCRYPTION_KEY;
  process.env.TOTP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    const encrypted = encryptGmailData("test-refresh-token");
    assert.match(encrypted, /^g1\./);
    assert.equal(decryptGmailData(encrypted), "test-refresh-token");
    assert.throws(() => decryptTotpSecret(encrypted));

    const legacy = encryptTotpSecret("legacy-cv-content");
    assert.equal(decryptGmailData(legacy), "legacy-cv-content");
  } finally {
    if (previous === undefined) delete process.env.TOTP_ENCRYPTION_KEY;
    else process.env.TOTP_ENCRYPTION_KEY = previous;
  }
});
