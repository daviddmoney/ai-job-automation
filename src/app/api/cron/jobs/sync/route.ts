import { NextRequest, NextResponse } from "next/server";
import { syncJobSources } from "@/lib/jobs/sources/sync";
import { configuredJobAdapters } from "@/lib/jobs/sources/configured";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
 const secret = process.env.CRON_SECRET;
 if (!secret || request.headers.get("authorization") !== "Bearer " + secret) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
 try { const key = requestRateLimitKey(request, "cron-job-sync"); if (!(await consumeRateLimit(key, 1, 3600))) return NextResponse.json({ message: "Sync already ran recently." }, { status: 429 }); }
 catch { return NextResponse.json({ message: "Sync protection unavailable." }, { status: 503 }); }
 const adapters = configuredJobAdapters();
 if (!adapters.length) return NextResponse.json({ message: "No job-source adapters configured." }, { status: 503 });
 const totals = await syncJobSources(adapters, new Date(Date.now() - 30 * 86400000));
 return NextResponse.json({ message: "Scheduled global job sync completed.", totals });
}