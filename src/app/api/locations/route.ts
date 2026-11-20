import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { consumeRateLimitWithInfo } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER = "https://countriesnow.space/api/v0.1";

function cleanItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string")
    .map(item => item.trim()).filter(item => item.length > 0 && item.length <= 120))].sort((a, b) => a.localeCompare(b));
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const limit = await consumeRateLimitWithInfo(`location-lookup:${session.user.id}`, 60, 60);
  if (!limit.allowed) {
    return NextResponse.json({ message: "Too many location lookups. Please try again shortly." }, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const country = params.get("country")?.trim() ?? "";
  const state = params.get("state")?.trim() ?? "";

  if (country.length < 2 || country.length > 100) {
    return NextResponse.json({ message: "A valid country is required." }, { status: 400 });
  }
  if (type !== "states" && type !== "cities") {
    return NextResponse.json({ message: "Unsupported location lookup." }, { status: 400 });
  }
  if (type === "cities" && (state.length < 2 || state.length > 120)) {
    return NextResponse.json({ message: "A valid state or region is required." }, { status: 400 });
  }

  try {
    const endpoint = type === "states" ? "/countries/states" : "/countries/state/cities";
    const payload = type === "states" ? { country } : { country, state };
    const response = await fetch(`${PROVIDER}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      return NextResponse.json({ message: "Location data provider is temporarily unavailable." }, { status: 502 });
    }

    const result: unknown = await response.json();
    const data = result && typeof result === "object" && "data" in result
      ? (result as { data: unknown }).data
      : null;
    const stateRows = data && typeof data === "object" && "states" in data
      ? (data as { states?: unknown }).states
      : null;
    const items = type === "states" && Array.isArray(stateRows)
      ? cleanItems(stateRows.map(item => item && typeof item === "object" && "name" in item ? (item as { name: unknown }).name : null))
      : type === "cities" ? cleanItems(data) : [];

    return NextResponse.json({ items }, {
      headers: { "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ message: "Unable to retrieve location data right now." }, { status: 502 });
  }
}
