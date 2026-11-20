import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { auth } from "@/auth";
import { consumeRateLimitWithInfo } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OccupationOption = { value: string; label: string; group: string };

const ILO_CSV = "https://www.ilo.org/ilostat-files/ISCO/newdocs-08-2021/ISCO-08/ISCO-08%20EN.csv";

function parseCsvRow(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value.trim());
  return values;
}

const getIscoOptions = unstable_cache(
  async (): Promise<OccupationOption[]> => {
    const response = await fetch(ILO_CSV, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error("ILO occupation catalogue unavailable");
    const bytes = await response.arrayBuffer();
    const csv = new TextDecoder("windows-1252").decode(bytes).replace(/^\uFEFF/, "");
    const lines = csv.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new Error("ILO occupation catalogue is empty");

    const headers = parseCsvRow(lines[0]).map(header => header.trim());
    const index = (name: string) => headers.indexOf(name);
    const columns = {
      version: index("ISCO_version"),
      major: index("major"),
      majorLabel: index("major_label"),
      subMajor: index("sub_major"),
      subMajorLabel: index("sub_major_label"),
      minor: index("minor"),
      minorLabel: index("minor_label"),
      unit: index("unit"),
      description: index("description"),
    };
    if (Object.values(columns).some(column => column < 0)) {
      throw new Error("Unexpected ILO occupation catalogue format");
    }

    const options = new Map<string, OccupationOption>();
    for (const line of lines.slice(1)) {
      const fields = parseCsvRow(line);
      if (fields[columns.version] !== "ISCO-08") continue;
      const major = (fields[columns.major] || "").padStart(1, "0");
      const majorLabel = fields[columns.majorLabel] || "";
      const subMajor = (fields[columns.subMajor] || "").padStart(2, "0");
      const subMajorLabel = fields[columns.subMajorLabel] || "";
      const minor = (fields[columns.minor] || "").padStart(3, "0");
      const minorLabel = fields[columns.minorLabel] || "";
      const unit = (fields[columns.unit] || "").padStart(4, "0");
      const description = fields[columns.description] || "";
      const group = [majorLabel, subMajorLabel, minorLabel].filter(Boolean).join(" / ");
      const add = (level: string, code: string, label: string, parent: string) => {
        if (!code || !label) return;
        const value = `ISCO08:${level}:${code}::${label}`;
        options.set(value, { value, label: `${label} (${code})`, group: parent });
      };
      add("M", major, majorLabel, "ISCO-08 major groups");
      add("S", subMajor, subMajorLabel, majorLabel);
      add("m", minor, minorLabel, [majorLabel, subMajorLabel].filter(Boolean).join(" / "));
      add("U", unit, description, group);
    }
    return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
  },
  ["ilo-isco08-occupation-catalogue-v1"],
  { revalidate: 604800 },
);

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const limit = await consumeRateLimitWithInfo(`occupation-lookup:${session.user.id}`, 60, 60);
  if (!limit.allowed) {
    return NextResponse.json({ message: "Too many occupation lookups. Please try again shortly." }, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const query = (request.nextUrl.searchParams.get("q") || "").trim().toLocaleLowerCase();
  const code = (request.nextUrl.searchParams.get("code") || "").trim();
  if (query.length > 100 || code.length > 120 || (!code && query.length < 2)) {
    return NextResponse.json({ items: [], source: "ILO ISCO-08" });
  }

  try {
    const catalogue = await getIscoOptions();
    const items = code
      ? catalogue.filter(option => option.value === code).slice(0, 1)
      : catalogue.filter(option =>
          option.label.toLocaleLowerCase().includes(query) ||
          option.value.toLocaleLowerCase().includes(query)
        ).slice(0, 100);
    return NextResponse.json({ items, source: "ILO ISCO-08", count: items.length }, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" },
    });
  } catch {
    return NextResponse.json({ message: "The international occupation catalogue is temporarily unavailable." }, { status: 502 });
  }
}
