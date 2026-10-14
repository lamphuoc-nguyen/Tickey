import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './safe-return-path';
describe('authentication return navigation', () => {
  it('keeps the Customer booking selection destination', () => {
    expect(safeReturnPath('/sessions/session/select?eventId=event')).toBe(
      '/sessions/session/select?eventId=event',
    );
  });
  it('rejects external, traversal and portal/staff destinations', () => {
    for (const path of ['https://evil.test', '//evil.test', '/profile/../admin', '/admin', '/staff'])
      expect(safeReturnPath(path)).toBe('/');
  });
});
