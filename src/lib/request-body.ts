export type LimitedJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; status: 400 | 413 | 415; message: string };

/** Read JSON with a hard byte ceiling; Content-Length is advisory, streaming limit is authoritative. */
export async function readLimitedJson(request: Request, maxBytes = 64 * 1024): Promise<LimitedJsonResult> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return { ok: false, status: 415, message: "Content-Type must be application/json." };
  }
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) return { ok: false, status: 400, message: "Invalid Content-Length." };
    if (Number(declared) > maxBytes) return { ok: false, status: 413, message: "Request body is too large." };
  }
  if (!request.body) return { ok: false, status: 400, message: "Request body is required." };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413, message: "Request body is too large." };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, message: "Unable to read request body." };
  } finally {
    reader.releaseLock();
  }
  try {
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { ok: true, data: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    return { ok: false, status: 400, message: "Invalid JSON request." };
  }
}
