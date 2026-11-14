import { NextRequest, NextResponse } from "next/server";
import { syncJobSources } from "@/lib/jobs/sources/sync";
import { JoobleNigeriaAdapter } from "@/lib/jobs/sources/jooble-ng";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  if (!process.env.JOOBLE_NG_API_KEY) return NextResponse.json({ message: "Job-source credentials are not configured." }, { status: 503 });
  try {
    const totals = await syncJobSources([new JoobleNigeriaAdapter()], new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    return NextResponse.json({ message: "Scheduled Lagos job sync completed.", totals });
  } catch {
    return NextResponse.json({ message: "Scheduled job sync failed." }, { status: 502 });
  }
}
