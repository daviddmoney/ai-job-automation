import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { verify } from "argon2";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-security";
import { readLimitedJson } from "@/lib/request-body";
import { decryptTotpSecret, otpDigest, verifyTotpCounter } from "@/lib/two-factor";

export const runtime = "nodejs";

function validBody(value: unknown): value is { password: string; code: string } {
  return typeof value === "object" && value !== null &&
    "password" in value && typeof value.password === "string" && value.password.length <= 256 &&
    "code" in value && typeof value.code === "string" && /^\d{6}$/.test(value.code);
}

/** Regenerate one-time recovery codes after password + current authenticator proof. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  if (!validBody(body.data)) return NextResponse.json({ message: "Enter your password and current six-digit authenticator code." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash || !user.twoFactorEnabled || user.twoFactorMethod !== "TOTP" || !user.twoFactorSecretCipher) {
    return NextResponse.json({ message: "Recovery codes are available only when authenticator-app two-factor authentication is enabled." }, { status: 409 });
  }
  try {
    if (!(await verify(user.passwordHash, body.data.password))) return NextResponse.json({ message: "Verification failed." }, { status: 403 });
    const counter = verifyTotpCounter(decryptTotpSecret(user.twoFactorSecretCipher), body.data.code);
    if (counter === null) return NextResponse.json({ message: "Verification failed." }, { status: 403 });
    const codes = Array.from({ length: 10 }, () => randomBytes(8).toString("hex").toUpperCase());
    const hashes = codes.map(otpDigest);
    const updated = await prisma.user.updateMany({
      where: {
        id: user.id,
        twoFactorEnabled: true,
        twoFactorMethod: "TOTP",
        twoFactorSecretCipher: user.twoFactorSecretCipher,
        OR: [{ twoFactorLastTotpCounter: null }, { twoFactorLastTotpCounter: { lt: BigInt(counter) } }]
      },
      data: { recoveryCodeHashes: hashes, twoFactorLastTotpCounter: BigInt(counter) }
    });
    if (updated.count !== 1) return NextResponse.json({ message: "This authenticator code has already been used. Wait for a new code and try again." }, { status: 409 });
    return NextResponse.json({ message: "Save these recovery codes securely. Each code can be used once; they will not be shown again.", recoveryCodes: codes });
  } catch {
    return NextResponse.json({ message: "Unable to regenerate recovery codes." }, { status: 500 });
  }
}
