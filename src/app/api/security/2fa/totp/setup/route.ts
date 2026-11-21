import { NextResponse } from "next/server";
import { verify } from "argon2";
import { z } from "zod";
import { auth } from "@/auth";
import { isSameOriginRequest } from "@/lib/request-security";
import { readLimitedJson } from "@/lib/request-body";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { createTotpSecret, encryptTotpSecret, totpUri } from "@/lib/two-factor";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  try {
    const key = requestRateLimitKey(request, "totp-setup", session.user.id);
    if (!(await consumeRateLimit(key, 5, 600))) return NextResponse.json({ message: "Too many setup attempts. Try again later." }, { status: 429 });
  } catch {
    return NextResponse.json({ message: "Security service unavailable." }, { status: 503 });
  }

  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const parsed = z.object({ password: z.string().min(1).max(256) }).safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ message: "Enter your current account password." }, { status: 400 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, passwordHash: true, twoFactorEnabled: true }
  });
  if (!user?.email || !user.passwordHash) return NextResponse.json({ message: "A password-protected account is required." }, { status: 409 });
  if (user.twoFactorEnabled) return NextResponse.json({ message: "Disable the current two-factor method with fresh proof before changing methods." }, { status: 409 });

  try {
    if (!(await verify(user.passwordHash, parsed.data.password))) return NextResponse.json({ message: "Verification failed." }, { status: 403 });
    const secret = createTotpSecret();
    const encrypted = encryptTotpSecret(secret);
    const stored = await prisma.user.updateMany({
      where: { id: user.id, twoFactorEnabled: false },
      data: { twoFactorPendingSecretCipher: encrypted }
    });
    if (stored.count !== 1) return NextResponse.json({ message: "Two-factor settings changed. Refresh and try again." }, { status: 409 });
    return NextResponse.json({ secret, otpauthUrl: totpUri(secret, user.email), message: "Add this account to an authenticator app, then confirm with the current six-digit code." });
  } catch {
    return NextResponse.json({ message: "Authenticator setup is not configured on the server." }, { status: 503 });
  }
}
