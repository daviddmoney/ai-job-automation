import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

function encryptionKey() {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOTP_ENCRYPTION_KEY_NOT_CONFIGURED");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("TOTP_ENCRYPTION_KEY_MUST_BE_32_BYTES_BASE64");
  return key;
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptTotpSecret(value: string) {
  const [ivPart, tagPart, dataPart] = value.split(".");
  if (!ivPart || !tagPart || !dataPart) throw new Error("INVALID_ENCRYPTED_TOTP_SECRET");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
}

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Encode(bytes: Buffer) {
  let bits = 0, value = 0, output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}
function base32Decode(input: string) {
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const char of input.replace(/=+$/g, "").toUpperCase()) {
    const idx = alphabet.indexOf(char);
    if (idx < 0) throw new Error("INVALID_BASE32_SECRET");
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export function createTotpSecret() { return base32Encode(randomBytes(20)); }

export function verifyTotpCounter(secret: string, supplied: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(supplied)) return null;
  const key = base32Decode(secret);
  const counter = Math.floor(now / 30_000);
  for (let offset = -1; offset <= 1; offset++) {
    const acceptedCounter = counter + offset;
    if (acceptedCounter < 0) continue;
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(acceptedCounter));
    const digest = createHmac("sha1", key).update(message).digest();
    const index = digest[digest.length - 1] & 0x0f;
    const binary = ((digest[index] & 0x7f) << 24) | ((digest[index + 1] & 0xff) << 16) | ((digest[index + 2] & 0xff) << 8) | (digest[index + 3] & 0xff);
    const expected = String(binary % 1_000_000).padStart(6, "0");
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return acceptedCounter;
  }
  return null;
}

export function verifyTotp(secret: string, supplied: string, now = Date.now()) {
  return verifyTotpCounter(secret, supplied, now) !== null;
}

export function otpDigest(code: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  return createHash("sha256").update(`${secret}:${code}`).digest("hex");
}

export function newEmailOtp() {
  return String(randomInt(1_000_000)).padStart(6, "0");
}

export function totpUri(secret: string, email: string) {
  const label = encodeURIComponent(`AI Job Automation:${email}`);
  const issuer = encodeURIComponent("AI Job Automation");
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

