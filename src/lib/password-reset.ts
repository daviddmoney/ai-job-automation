import { createHmac } from "node:crypto";

export function passwordResetTokenDigest(token: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  return createHmac("sha256", secret).update(`password-reset:v1:${token}`, "utf8").digest("hex");
}
