import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { decryptTotpSecret } from "@/lib/two-factor";

const CONTEXT = Buffer.from("ai-job-automation:gmail-cv-oauth:v1", "utf8");

function gmailDataKey() {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOTP_ENCRYPTION_KEY_NOT_CONFIGURED");
  const root = Buffer.from(raw, "base64");
  if (root.length !== 32) throw new Error("TOTP_ENCRYPTION_KEY_MUST_BE_32_BYTES_BASE64");
  // Derive a domain-separated key so Gmail tokens/CV data do not reuse the raw TOTP key.
  return Buffer.from(hkdfSync("sha256", root, Buffer.from("ai-job-automation-kdf-v1"), CONTEXT, 32));
}

export function encryptGmailData(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", gmailDataKey(), iv);
  cipher.setAAD(CONTEXT);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["g1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptGmailData(value: string) {
  // Existing records were encrypted with the original TOTP helper. Keep a read fallback
  // so the key-separation improvement does not make already-stored connections/CVs unreadable.
  if (!value.startsWith("g1.")) return decryptTotpSecret(value);
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "g1" || !parts[1] || !parts[2] || !parts[3]) {
    throw new Error("INVALID_ENCRYPTED_GMAIL_DATA");
  }
  const [, ivPart, tagPart, dataPart] = parts;
  const decipher = createDecipheriv("aes-256-gcm", gmailDataKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAAD(CONTEXT);
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
}
