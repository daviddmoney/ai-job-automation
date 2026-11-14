import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptTotpSecret, verifyTotp } from "@/lib/two-factor";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = z.object({ code: z.string().regex(/^\\d{6}$/) }).safeParse(body);
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
