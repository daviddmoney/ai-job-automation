import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-security";
export const runtime = "nodejs";
const language = z.string().trim().min(2).max(20);
const schema = z.object({
 preferredCountries: z.array(z.string().trim().min(2).max(100)).max(100).optional(),
 preferredRegions: z.array(z.string().trim().min(2).max(100)).max(200).optional(),
 preferredCities: z.array(z.string().trim().min(2).max(100)).max(200).optional(),
 preferredWorkModes: z.array(z.enum(["ONSITE", "HYBRID", "REMOTE", "FLEXIBLE"])).max(4).optional(),
 employmentTypes: z.array(z.string().trim().min(2).max(80)).max(30).optional(),
 jobCategories: z.array(z.string().trim().min(2).max(100)).max(100).optional(),
 interfaceLanguage: language.optional(), nativeLanguage: language.nullable().optional(),
 jobDescriptionLanguage: language.optional(), applicationLanguage: language.optional(),
 communicationLanguage: language.optional(), additionalLanguages: z.array(language).max(50).optional(),
 worldwideSearch: z.boolean().optional()
}).strict();
export async function GET() {
 const session = await auth();
 if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
 const preferences = await prisma.userJobPreference.findUnique({ where: { userId: session.user.id } });
 return NextResponse.json({ preferences });
}
export async function PUT(request: NextRequest) {
 if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
 const session = await auth();
 if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
 const parsed = schema.safeParse(await request.json().catch(() => null));
 if (!parsed.success) return NextResponse.json({ message: "Invalid job preferences." }, { status: 400 });
 const preferences = await prisma.userJobPreference.upsert({
  where: { userId: session.user.id }, create: { userId: session.user.id, ...parsed.data }, update: parsed.data
 });
 return NextResponse.json({ message: "Your private job and language preferences were saved.", preferences });
}