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

/** HMAC-keyed digest for six-digit email OTPs; recovery-code hashes remain compatible. */
export function emailSecondFactorDigest(code: string, userId: string, purpose: "login" | "activation" | "recovery" | "disable" = "login") {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  return createHmac("sha256", secret).update(`email-second-factor:${purpose}:v1:${userId}:${code}`, "utf8").digest("hex");
}

/**
 * Atomically consumes an email second-factor code or increments its failed
 * attempt counter. When activate=true, successful consumption enables email
 * 2FA in the same database statement.
 */
type RawQueryClient = {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};
export async function consumeEmailSecondFactorCode(
  db: RawQueryClient,
  userId: string,
  suppliedDigest: string,
  activate = false
): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ accepted: boolean }>>`
    UPDATE "User"
    SET
      "twoFactorEnabled" = CASE WHEN ${activate} AND "twoFactorEmailCodeHash" = ${suppliedDigest} THEN TRUE ELSE "twoFactorEnabled" END,
      "twoFactorMethod" = CASE WHEN ${activate} AND "twoFactorEmailCodeHash" = ${suppliedDigest} THEN 'EMAIL' ELSE "twoFactorMethod" END,
      "twoFactorSecretCipher" = CASE WHEN ${activate} AND "twoFactorEmailCodeHash" = ${suppliedDigest} THEN NULL ELSE "twoFactorSecretCipher" END,
      "twoFactorPendingSecretCipher" = CASE WHEN ${activate} AND "twoFactorEmailCodeHash" = ${suppliedDigest} THEN NULL ELSE "twoFactorPendingSecretCipher" END,
      "recoveryCodeHashes" = CASE WHEN ${activate} AND "twoFactorEmailCodeHash" = ${suppliedDigest} THEN ARRAY[]::text[] ELSE "recoveryCodeHashes" END,
      "twoFactorLastTotpCounter" = CASE WHEN ${activate} AND "twoFactorEmailCodeHash" = ${suppliedDigest} THEN NULL ELSE "twoFactorLastTotpCounter" END,
      "twoFactorEmailCodeHash" = CASE
        WHEN "twoFactorEmailCodeHash" = ${suppliedDigest} THEN NULL
        ELSE "twoFactorEmailCodeHash"
      END,
      "twoFactorEmailCodeExpiresAt" = CASE
        WHEN "twoFactorEmailCodeHash" = ${suppliedDigest} THEN NULL
        ELSE "twoFactorEmailCodeExpiresAt"
      END,
      "twoFactorEmailCodeAttempts" = CASE
        WHEN "twoFactorEmailCodeHash" = ${suppliedDigest} THEN 0
        ELSE "twoFactorEmailCodeAttempts" + 1
      END,
      "sessionVersion" = CASE
        WHEN ${activate} AND "twoFactorEmailCodeHash" = ${suppliedDigest} THEN "sessionVersion" + 1
        ELSE "sessionVersion"
      END,
      "updatedAt" = (clock_timestamp() AT TIME ZONE 'UTC')
    WHERE
      "id" = ${userId}
      AND ((${activate} = TRUE AND "twoFactorEnabled" = FALSE)
        OR (${activate} = FALSE AND "twoFactorEnabled" = TRUE AND "twoFactorMethod" = 'EMAIL'))
      AND "twoFactorEmailCodeHash" IS NOT NULL
      AND "twoFactorEmailCodeExpiresAt" > (clock_timestamp() AT TIME ZONE 'UTC')
      AND "twoFactorEmailCodeAttempts" < 5
    RETURNING ("twoFactorEmailCodeHash" IS NULL) AS accepted
  `;
  return rows[0]?.accepted === true;
}

export function newEmailOtp() {
  return String(randomInt(1_000_000)).padStart(6, "0");
}

type TwoFactorOtpDatabase = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

/** Store a five-minute email 2FA code with expiry generated by PostgreSQL. */
export async function issueEmailTwoFactorCode(database: TwoFactorOtpDatabase, userId: string, digest: string) {
  const rows = await database.$queryRaw<Array<{ expiresAt: Date }>>`
    WITH issue_time AS (SELECT clock_timestamp() + INTERVAL '5 minutes' AS expires_at)
    UPDATE "User" AS account
    SET
      "twoFactorEmailCodeHash" = ${digest},
      "twoFactorEmailCodeExpiresAt" = issue_time.expires_at,
      "twoFactorEmailCodeAttempts" = 0
    FROM issue_time
    WHERE account."id" = ${userId}
      AND account."twoFactorEnabled" = TRUE
      AND account."twoFactorMethod" = 'EMAIL'
    RETURNING account."twoFactorEmailCodeExpiresAt" AS "expiresAt"
  `;
  return rows[0]?.expiresAt ?? null;
}

/** Atomically verify and consume an email 2FA code, enforcing the five-attempt cap. */
export async function consumeEmailTwoFactorCode(database: TwoFactorOtpDatabase, userId: string, digest: string) {
  const consumed = await database.$queryRaw<Array<{ id: string }>>`
    WITH verification_time AS (SELECT clock_timestamp() AS now)
    UPDATE "User" AS account
    SET
      "twoFactorEmailCodeHash" = NULL,
      "twoFactorEmailCodeExpiresAt" = NULL,
      "twoFactorEmailCodeAttempts" = 0
    FROM verification_time
    WHERE account."id" = ${userId}
      AND account."twoFactorEnabled" = TRUE
      AND account."twoFactorMethod" = 'EMAIL'
      AND account."twoFactorEmailCodeHash" = ${digest}
      AND account."twoFactorEmailCodeExpiresAt" > verification_time.now
      AND account."twoFactorEmailCodeAttempts" < 5
    RETURNING account."id"
  `;
  if (consumed.length === 1) return true;

  await database.$queryRaw<Array<{ id: string }>>`
    WITH verification_time AS (SELECT clock_timestamp() AS now)
    UPDATE "User" AS account
    SET "twoFactorEmailCodeAttempts" = account."twoFactorEmailCodeAttempts" + 1
    FROM verification_time
    WHERE account."id" = ${userId}
      AND account."twoFactorEnabled" = TRUE
      AND account."twoFactorMethod" = 'EMAIL'
      AND account."twoFactorEmailCodeHash" IS DISTINCT FROM ${digest}
      AND account."twoFactorEmailCodeExpiresAt" > verification_time.now
      AND account."twoFactorEmailCodeAttempts" < 5
    RETURNING account."id"
  `;
  return false;
}

export function totpUri(secret: string, email: string) {
  const label = encodeURIComponent(`AI Job Automation:${email}`);
  const issuer = encodeURIComponent("AI Job Automation");
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}


/**
 * Email fallback recovery for a user who has lost their TOTP authenticator and
 * recovery codes. Requires a verified email, password proof at the route, a
 * fresh account-bound recovery OTP, expiry and the same five-attempt ceiling.
 * Successful recovery disables TOTP and revokes all existing JWT sessions.
 */
export async function consumeEmailSecondFactorRecoveryCode(
  db: RawQueryClient,
  userId: string,
  suppliedDigest: string
): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ accepted: boolean }>>`
    UPDATE "User"
    SET
      "twoFactorEnabled" = CASE
        WHEN "twoFactorEmailCodeHash" = ${suppliedDigest} THEN FALSE
        ELSE "twoFactorEnabled"
      END,
      "twoFactorMethod" = CASE
        WHEN "twoFactorEmailCodeHash" = ${suppliedDigest} THEN NULL
        ELSE "twoFactorMethod"
      END,
      "twoFactorSecretCipher" = CASE
        WHEN "twoFactorEmailCodeHash" = ${suppliedDigest} THEN NULL
        ELSE "twoFactorSecretCipher"
      END,
      "twoFactorPendingSecretCipher" = CASE
        WHEN "twoFactorEmailCodeHash" = ${suppliedDigest} THEN NULL
        ELSE "twoFactorPendingSecretCipher"
      END,
      "recoveryCodeHashes" = CASE
        WHEN "twoFactorEmailCodeHash" = ${suppliedDigest} THEN ARRAY[]::text[]
        ELSE "recoveryCodeHashes"
      END,
      "twoFactorLastTotpCounter" = CASE
        WHEN "twoFactorEmailCodeHash" = ${suppliedDigest} THEN NULL
        ELSE "twoFactorLastTotpCounter"
      END,
      "twoFactorEmailCodeHash" = CASE
        WHEN "twoFactorEmailCodeHash" = ${suppliedDigest} THEN NULL
        ELSE "twoFactorEmailCodeHash"
      END,
      "twoFactorEmailCodeExpiresAt" = CASE
        WHEN "twoFactorEmailCodeHash" = ${suppliedDigest} THEN NULL
        ELSE "twoFactorEmailCodeExpiresAt"
      END,
      "twoFactorEmailCodeAttempts" = CASE
        WHEN "twoFactorEmailCodeHash" = ${suppliedDigest} THEN 0
        ELSE "twoFactorEmailCodeAttempts" + 1
      END,
      "sessionVersion" = CASE
        WHEN "twoFactorEmailCodeHash" = ${suppliedDigest} THEN "sessionVersion" + 1
        ELSE "sessionVersion"
      END,
      "updatedAt" = (clock_timestamp() AT TIME ZONE 'UTC')
    WHERE
      "id" = ${userId}
      AND "emailVerified" IS NOT NULL
      AND "twoFactorEnabled" = TRUE
      AND "twoFactorMethod" = 'TOTP'
      AND "twoFactorEmailCodeHash" IS NOT NULL
      AND "twoFactorEmailCodeExpiresAt" > (clock_timestamp() AT TIME ZONE 'UTC')
      AND "twoFactorEmailCodeAttempts" < 5
    RETURNING ("twoFactorEmailCodeHash" IS NULL) AS accepted
  `;
  return rows[0]?.accepted === true;
}

/** Issue an account-bound email OTP with a database-clock expiry. */
export async function issueEmailSecondFactorCode(
  db: RawQueryClient,
  userId: string,
  digest: string,
  expiresMinutes: number,
  purpose: "login" | "activation" | "recovery" | "disable"
): Promise<boolean> {
  if (!Number.isInteger(expiresMinutes) || expiresMinutes < 1 || expiresMinutes > 15) {
    throw new Error("INVALID_EMAIL_2FA_EXPIRY");
  }
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    UPDATE "User"
    SET
      "twoFactorEmailCodeHash" = ${digest},
      "twoFactorEmailCodeExpiresAt" = (clock_timestamp() AT TIME ZONE 'UTC') + (${expiresMinutes} * INTERVAL '1 minute'),
      "twoFactorEmailCodeAttempts" = 0,
      "updatedAt" = (clock_timestamp() AT TIME ZONE 'UTC')
    WHERE "id" = ${userId}
      AND "emailVerified" IS NOT NULL
      AND (
        (${purpose} IN ('login', 'disable') AND "twoFactorEnabled" = TRUE AND "twoFactorMethod" = 'EMAIL')
        OR (${purpose} = 'activation' AND "twoFactorEnabled" = FALSE)
        OR (${purpose} = 'recovery' AND "twoFactorEnabled" = TRUE AND "twoFactorMethod" = 'TOTP')
      )
    RETURNING "id"
  `;
  return rows.length === 1;
}
