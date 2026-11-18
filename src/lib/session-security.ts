export function isSessionVersionCurrent(tokenVersion: unknown, currentVersion: number) {
  return Number.isInteger(tokenVersion) && tokenVersion === currentVersion;
}
