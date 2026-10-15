import { describe, it, expect } from 'vitest';
import { runExclusive } from './exclusive-request';
describe('requests across navigation', () => {
  it('blocks the same request scope until the response settles', async () => {
    let finish!: () => void;
    const wait = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const first = runExclusive('one', () => wait);
    await expect(runExclusive('one', async () => {})).rejects.toThrow('đang được xử lý');
    await expect(runExclusive('other', async () => 42)).resolves.toBe(42);
    finish();
    await first;
    await expect(runExclusive('one', async () => 1)).resolves.toBe(1);
  });
  it('allows retry after a failed request without retaining a dead lock', async () => {
    await expect(
      runExclusive('failed', async () => {
        throw new Error('network');
      }),
    ).rejects.toThrow('network');
    await expect(runExclusive('failed', async () => true)).resolves.toBe(true);
  });
});
