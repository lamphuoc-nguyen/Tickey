import { describe, expect, it } from 'vitest';
import { notificationDay, notificationTime } from './notification-presentation';

describe('notification time labels', () => {
  const now = new Date(2026, 0, 1, 0, 5);
  it('uses calendar days across midnight and a year boundary', () => {
    expect(notificationDay(new Date(2026, 0, 1, 0, 1).toISOString(), now)).toBe('Hôm nay');
    expect(notificationDay(new Date(2025, 11, 31, 23, 59).toISOString(), now)).toBe('Hôm qua');
    expect(notificationDay(new Date(2025, 11, 30).toISOString(), now)).toBe('Trước đó');
  });
  it('retains the year for older records and avoids Invalid Date text', () => {
    expect(notificationTime(new Date(2025, 11, 31, 23, 59).toISOString(), now)).toContain('2025');
    expect(notificationTime('invalid', now)).toBe('Chưa có thời gian');
    expect(notificationDay('invalid', now)).toBe('Chưa rõ thời gian');
  });
});
