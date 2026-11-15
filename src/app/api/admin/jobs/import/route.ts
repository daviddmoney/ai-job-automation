import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/server-auth";
import { ingestJob } from "@/lib/jobs/ingest";
import { isSameOriginRequest } from "@/lib/request-security";
import { readLimitedJson } from "@/lib/request-body";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
 if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
 try { await requireStaff(); } catch { return NextResponse.json({ message: "Staff access required." }, { status: 403 }); }
 const body = await readLimitedJson(request, 1024 * 1024);
 if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
 if (!Array.isArray(body.data) || body.data.length < 1 || body.data.length > 100) return NextResponse.json({ message: "Provide between 1 and 100 job records." }, { status: 400 });
 const counts = { created: 0, updated: 0, invalid: 0 };
 for (const item of body.data) {
  const result = await ingestJob(item);
  if (result.outcome === "created") counts.created++;
  else if (result.outcome === "updated") counts.updated++;
  else counts.invalid++;
 }
 return NextResponse.json({ message: "Global job import processed.", counts });
}