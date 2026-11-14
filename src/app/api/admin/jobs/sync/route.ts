import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/server-auth";
import { isSameOriginRequest } from "@/lib/request-security";
import { syncJobSources } from "@/lib/jobs/sources/sync";
import { JoobleNigeriaAdapter } from "@/lib/jobs/sources/jooble-ng";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  let staff;\n  try { staff = await requireStaff(); } catch { return NextResponse.json({ message: "Staff access required." }, { status: 403 }); }\n  try { const key = requestRateLimitKey(request, "manual-job-sync", staff.id); if (!(await consumeRateLimit(key, 5, 86400))) return NextResponse.json({ message: "Daily manual sync limit reached. Use the scheduled sync." }, { status: 429 }); } catch { return NextResponse.json({ message: "Sync protection unavailable." }, { status: 503 }); }
  if (!process.env.JOOBLE_NG_API_KEY) return NextResponse.json({ message: "Jooble Nigeria API key is not configured." }, { status: 503 });
  try {
    const totals = await syncJobSources([new JoobleNigeriaAdapter()], new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    return NextResponse.json({ message: "Lagos job-source sync completed.", totals });
  } catch {
    return NextResponse.json({ message: "Job-source sync failed. Check provider access and server logs." }, { status: 502 });
  }
}
