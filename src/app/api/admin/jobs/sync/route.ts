import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/server-auth";
import { isSameOriginRequest } from "@/lib/request-security";
import { syncJobSources } from "@/lib/jobs/sources/sync";
import { configuredJobAdapters } from "@/lib/jobs/sources/configured";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
 if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
 let staff;
 try { staff = await requireStaff(); } catch { return NextResponse.json({ message: "Staff access required." }, { status: 403 }); }
 try { const key = requestRateLimitKey(request, "manual-job-sync", staff.id); if (!(await consumeRateLimit(key, 5, 86400))) return NextResponse.json({ message: "Daily manual sync limit reached. Use scheduled sync." }, { status: 429 }); }
 catch { return NextResponse.json({ message: "Sync protection unavailable." }, { status: 503 }); }
 const adapters = configuredJobAdapters();
 if (!adapters.length) return NextResponse.json({ message: "No job sources configured. Add approved employer board identifiers or provider credentials." }, { status: 503 });
 const totals = await syncJobSources(adapters, new Date(Date.now() - 30 * 86400000));
 return NextResponse.json({ message: "Global job-source sync completed.", totals });
}