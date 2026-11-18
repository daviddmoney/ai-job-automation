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
    UPDATE "User"
    SET
      "emailVerified" = clock_timestamp(),
      "emailVerificationCodeHash" = NULL,
      "emailVerificationExpiresAt" = NULL,
      "emailVerificationAttempts" = 0
    WHERE
      "email" = ${email}
      AND "emailVerified" IS NULL
      AND "emailVerificationCodeHash" = ${suppliedDigest}
      AND "emailVerificationExpiresAt" > clock_timestamp()
      AND "emailVerificationAttempts" < 5
    RETURNING "id"
  `;

  if (verified.length === 1) return true;

  // A wrong code is charged only while the OTP is still live and unconsumed.
  // The predicate and increment execute atomically in PostgreSQL.
  await database.$queryRaw<Array<{ id: string }>>`
    UPDATE "User"
    SET "emailVerificationAttempts" = "emailVerificationAttempts" + 1
    WHERE
      "email" = ${email}
      AND "emailVerified" IS NULL
      AND "emailVerificationCodeHash" IS DISTINCT FROM ${suppliedDigest}
      AND "emailVerificationExpiresAt" > clock_timestamp()
      AND "emailVerificationAttempts" < 5
    RETURNING "id"
  `;

  return false;
}
