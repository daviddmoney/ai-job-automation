export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const parsedOrigin = new URL(origin);
    const expectedProtocol = process.env.NODE_ENV === "production"
      ? "https:"
      : new URL(request.url).protocol;
    // Compare the full origin, not only host. In production, reject HTTP
    // origins even when the host matches the HTTPS application.
    return parsedOrigin.origin === `${expectedProtocol}//${host}`;
  } catch {
    return false;
  }
}
