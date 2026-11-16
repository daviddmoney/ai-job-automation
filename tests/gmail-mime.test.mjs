import test from "node:test";
import assert from "node:assert/strict";
import { buildMimeMessage } from "../src/lib/gmail-mime.ts";

test("Gmail MIME preserves the exact PDF bytes as a base64 attachment", () => {
  const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(2048, 0x5a), Buffer.from("\n%%EOF")]);
  const raw = buildMimeMessage({
    from: "sender@example.com",
    to: "recruitment@example.com",
    subject: "Application for Accountant",
    body: "Please find my CV attached.",
    attachment: { fileName: "Candidate CV.pdf", mimeType: "application/pdf", content: pdf }
  });
  const mime = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  assert.match(mime, /Content-Disposition: attachment; filename="Candidate CV\.pdf"/);
  assert.match(mime, /Content-Type: application\/pdf; name="Candidate CV\.pdf"/);
  const payload = mime.split("Content-Disposition: attachment; filename=")[1].split("\r\n\r\n")[1].split("\r\n--")[0].replace(/\s/g, "");
  assert.deepEqual(Buffer.from(payload, "base64"), pdf);
  assert.match(mime, /Subject: Application for Accountant/);
});

test("Gmail MIME sanitizes CR/LF in header values", () => {
  const raw = buildMimeMessage({
    from: "sender@example.com\r\nBcc: attacker@example.com",
    to: "recruitment@example.com",
    subject: "Hello\r\nBcc: attacker@example.com",
    body: "Body",
    attachment: { fileName: "cv.pdf", mimeType: "application/pdf", content: Buffer.from("%PDF-1.4") }
  });
  const mime = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  assert.equal((mime.match(/\r\nBcc:/g) || []).length, 0);
  assert.match(mime, /Subject: Hello Bcc: attacker@example\.com/);
});
