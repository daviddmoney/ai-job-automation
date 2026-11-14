export async function withJobSyncLeaseGuard<T>(
  assertLease: () => Promise<void>,
  write: () => Promise<T>
): Promise<T> {
  await assertLease();
  return write();
}
