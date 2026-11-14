import { NextRequest, NextResponse } from "next/server";
import { verifyAccountEmail } from "@/lib/registration";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Invalid request." }, { status: 400 }); }
  try {
    const result = await verifyAccountEmail(body);
    return NextResponse.json({ message: result.message }, { status: result.ok ? 200 : result.status });
  } catch {
    return NextResponse.json({ message: "Unable to verify the account right now." }, { status: 500 });
  }
}
