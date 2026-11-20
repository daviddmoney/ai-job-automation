import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { consumeRateLimitWithInfo } from "@/lib/rate-limit";
import languageRows from "iso-639-3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LanguageRow = {
  name: string;
  type: string;
  scope: string;
  iso6393: string;
  iso6391?: string;
};

const languages = languageRows as LanguageRow[];

function toOption(language: LanguageRow, requestedCode?: string) {
  const value = requestedCode && [language.iso6391, language.iso6393].includes(requestedCode)
    ? requestedCode
    : language.iso6391 || language.iso6393;
  const codeLabel = language.iso6391
    ? `${language.iso6393} · ISO 639-1 ${language.iso6391}`
    : `${language.iso6393} · ISO 639-3`;
  return { value, label: `${language.name} (${codeLabel})` };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const limit = await consumeRateLimitWithInfo(`language-lookup:${session.user.id}`, 60, 60);
  if (!limit.allowed) {
    return NextResponse.json({ message: "Too many language lookups. Please try again shortly." }, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const params = request.nextUrl.searchParams;
  const query = (params.get("q") || "").trim().toLocaleLowerCase();
  const code = (params.get("code") || "").trim().toLocaleLowerCase();

  if (query.length > 80 || code.length > 8) {
    return NextResponse.json({ message: "Language search is too long." }, { status: 400 });
  }

  let matches: LanguageRow[];
  if (code) {
    matches = languages.filter(language =>
      language.iso6393.toLocaleLowerCase() === code ||
      language.iso6391?.toLocaleLowerCase() === code
    ).slice(0, 5);
  } else if (query.length >= 2) {
    matches = languages
      .filter(language =>
        language.name.toLocaleLowerCase().includes(query) ||
        language.iso6393.toLocaleLowerCase().startsWith(query) ||
        language.iso6391?.toLocaleLowerCase() === query
      )
      .sort((a, b) => {
        const score = (language: LanguageRow) =>
          language.name.toLocaleLowerCase() === query ? 0 :
          language.name.toLocaleLowerCase().startsWith(query) ? 1 :
          language.type === "living" && language.scope === "individual" ? 2 : 3;
        return score(a) - score(b) || a.name.localeCompare(b.name);
      })
      .slice(0, 100);
  } else {
    matches = languages
      .filter(language => language.type === "living" && language.scope === "individual" && language.iso6391)
      .slice(0, 100);
  }

  const items = [...new Map(matches.map(language => {
    const option = toOption(language, code || undefined);
    return [option.value, option];
  })).values()];

  return NextResponse.json({ items, source: "ISO 639-3 / ISO 639-1", count: items.length }, {
    headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" },
  });
}
