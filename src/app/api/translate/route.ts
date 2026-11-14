import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isSameOriginRequest } from "@/lib/request-security";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";
import { translateText } from "@/lib/translation";
export const runtime = "nodejs";
const schema = z.object({
 text: z.string().min(1).max(12000),
 sourceLanguage: z.string().regex(/^[a-zA-Z-]{2,20}$/).optional(),
 targetLanguage: z.string().regex(/^[a-zA-Z-]{2,20}$/)
});
export async function POST(request: NextRequest) {
 if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
 const session = await auth();
 if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
 try {
  const key = requestRateLimitKey(request, "translation", session.user.id);
  if (!(await consumeRateLimit(key, 30, 3600))) return NextResponse.json({ message: "Translation limit reached. Try again later." }, { status: 429 });
 } catch { return NextResponse.json({ message: "Translation protection is unavailable." }, { status: 503 }); }
 const parsed = schema.safeParse(await request.json().catch(() => null));
 if (!parsed.success) return NextResponse.json({ message: "Invalid translation request." }, { status: 400 });
 try {
  const result = await translateText(parsed.data);
  return NextResponse.json({ result, reviewRequired: true, notice: "Review the translation before using it in an application or sending it to an employer." });
 } catch (error) {
  const code = error instanceof Error ? error.message : "";
  const status = code === "TRANSLATION_NOT_CONFIGURED" ? 503 : code === "TRANSLATION_TEXT_INVALID" || code === "TRANSLATION_LANGUAGE_INVALID" ? 400 : 502;
  return NextResponse.json({ message: status === 503 ? "No translation provider is configured." : status === 400 ? "Invalid translation request." : "Translation providers are temporarily unavailable." }, { status });
 }
}