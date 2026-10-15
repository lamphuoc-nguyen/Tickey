const active = new Set<string>();
/** Keep the lock across screen unmount/remount; it never replaces server idempotency. */
export async function runExclusive<T>(key: string, run: () => Promise<T>): Promise<T> {
  if (active.has(key)) throw new Error('Yêu cầu đang được xử lý.');
  active.add(key);
  try {
    return await run();
  } finally {
    active.delete(key);
  }
}
