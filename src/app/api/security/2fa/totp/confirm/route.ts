import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isSameOriginRequest } from "@/lib/request-security";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { decryptTotpSecret, verifyTotp } from "@/lib/two-factor";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  try { const key = requestRateLimitKey(request, "totp-confirm", session.user.id); if (!(await consumeRateLimit(key, 8, 600))) return NextResponse.json({ message: "Too many code attempts. Try again later." }, { status: 429 }); } catch { return NextResponse.json({ message: "Security service unavailable." }, { status: 503 }); }
  const body = await request.json().catch(() => null);
  const parsed = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Enter a six-digit authenticator code." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { twoFactorPendingSecretCipher: true } });
  if (!user?.twoFactorPendingSecretCipher) return NextResponse.json({ message: "Start authenticator setup first." }, { status: 400 });
  try {
    const secret = decryptTotpSecret(user.twoFactorPendingSecretCipher);
    if (!verifyTotp(secret, parsed.data.code)) return NextResponse.json({ message: "The code is invalid or expired." }, { status: 400 });
    await prisma.user.update({ where: { id: session.user.id }, data: { twoFactorSecretCipher: user.twoFactorPendingSecretCipher, twoFactorPendingSecretCipher: null, twoFactorEnabled: true, twoFactorMethod: "TOTP" } });
    return NextResponse.json({ message: "Authenticator two-factor authentication enabled." });
  } catch { return NextResponse.json({ message: "Authenticator setup could not be completed." }, { status: 503 }); }
}
