export interface BoardRunResult { target: string; status: "succeeded" | "failed"; error?: string; }
export async function fetchBoardJson<T>(url: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        const error = new Error(`HTTP_${response.status}`);
        if (response.status < 500 && response.status !== 429) throw error;
        lastError = error;
      } else return await response.json() as T;
    } catch (error) {
      lastError = error;
      if (error instanceof Error && /^HTTP_4/.test(error.message) && error.message !== "HTTP_429") throw error;
    }
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 300 * 2 ** (attempt - 1)));
  }
  throw lastError instanceof Error ? lastError : new Error("BOARD_REQUEST_FAILED");
}

/** Explicit, reviewed mapping: { "greenhouse:board-token": "Employer Ltd" }. */
export function mappedEmployerName(provider: string, board: string): string | null {
  try {
    const raw = process.env.JOB_BOARD_EMPLOYER_NAMES;
    if (!raw) return null;
    const mapping = JSON.parse(raw) as Record<string, unknown>;
    const value = mapping[`${provider}:${board}`];
    return typeof value === "string" && value.trim().length > 1 ? value.trim().slice(0, 250) : null;
  } catch { return null; }
}

export function employerName(provider: string, board: string, verifiedMetadata?: unknown): string | null {
  if (typeof verifiedMetadata === "string" && verifiedMetadata.trim().length > 1) return verifiedMetadata.trim().slice(0, 250);
  return mappedEmployerName(provider, board);
}

export function explicitRemoteEligibility(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map(item => item.trim().slice(0, 150)))].slice(0, 100);
}
