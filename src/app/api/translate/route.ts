import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isSameOriginRequest } from "@/lib/request-security";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";
import { translateText, isSupportedTranslationLanguage } from "@/lib/translation";
import { readLimitedJson } from "@/lib/request-body";
export const runtime = "nodejs";
const MAX_BODY_BYTES = 48 * 1024;
const schema = z.object({
 text: z.string().min(1).max(12000),
 sourceLanguage: z.string().optional(),
 targetLanguage: z.string()
}).strict();


export async function POST(request: NextRequest) {
 if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
 const session = await auth();
 if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
 if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
  return NextResponse.json({ message: "Content-Type must be application/json." }, { status: 415 });
 }
 try {
  const key = requestRateLimitKey(request, "translation", session.user.id);
  if (!(await consumeRateLimit(key, 30, 3600))) return NextResponse.json({ message: "Translation limit reached. Try again later." }, { status: 429 });
 } catch { return NextResponse.json({ message: "Translation protection is unavailable." }, { status: 503 }); }
 const body = await readLimitedJson(request, MAX_BODY_BYTES);
 if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
 const parsed = schema.safeParse(body.data);
 if (!parsed.success || !isSupportedTranslationLanguage(parsed.data.targetLanguage) ||
     (parsed.data.sourceLanguage !== undefined && parsed.data.sourceLanguage !== "auto" && !isSupportedTranslationLanguage(parsed.data.sourceLanguage))) {
  return NextResponse.json({ message: "Unsupported language or invalid translation request." }, { status: 400 });
 }
 try {
  const result = await translateText(parsed.data);
  return NextResponse.json({ result, reviewRequired: true, notice: "Review the translation before using it in an application or sending it to an employer." });
 } catch (error) {
  const code = error instanceof Error ? error.message : "";
  const status = code === "TRANSLATION_NOT_CONFIGURED" ? 503 : code === "TRANSLATION_TEXT_INVALID" || code === "TRANSLATION_LANGUAGE_INVALID" || code === "TRANSLATION_LANGUAGE_UNSUPPORTED" ? 400 : 502;
  return NextResponse.json({ message: status === 503 ? "No translation provider is configured." : status === 400 ? "Invalid or unsupported translation language." : "Translation providers are temporarily unavailable." }, { status });
 }
}
