type VerificationDatabase = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

/**
 * Atomically consumes a pending email verification code.
 * PostgreSQL's live clock is authoritative for both expiry and verification time.
 */
export async function consumeEmailVerificationCode(
  database: VerificationDatabase,
  email: string,
  suppliedDigest: string
) {
  const verified = await database.$queryRaw<Array<{ id: string }>>`
    WITH verification_time AS (SELECT clock_timestamp() AS now)
    UPDATE "User" AS account
    SET
      "emailVerified" = verification_time.now,
      "emailVerificationCodeHash" = NULL,
      "emailVerificationExpiresAt" = NULL,
      "emailVerificationAttempts" = 0
    FROM verification_time
    WHERE
      account."email" = ${email}
      AND account."emailVerified" IS NULL
      AND account."emailVerificationCodeHash" = ${suppliedDigest}
      AND account."emailVerificationExpiresAt" > verification_time.now
      AND account."emailVerificationAttempts" < 5
    RETURNING account."id"
  `;

  if (verified.length === 1) return true;

  // A wrong code is charged only while the OTP is still live and unconsumed.
  // The predicate and increment execute atomically in PostgreSQL.
  await database.$queryRaw<Array<{ id: string }>>`
    WITH verification_time AS (SELECT clock_timestamp() AS now)
    UPDATE "User" AS account
    SET "emailVerificationAttempts" = account."emailVerificationAttempts" + 1
    FROM verification_time
    WHERE
      account."email" = ${email}
      AND account."emailVerified" IS NULL
      AND account."emailVerificationCodeHash" IS DISTINCT FROM ${suppliedDigest}
      AND account."emailVerificationExpiresAt" > verification_time.now
      AND account."emailVerificationAttempts" < 5
    RETURNING account."id"
  `;

  return false;
}
