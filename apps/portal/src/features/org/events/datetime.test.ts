import { describe, expect, it } from 'vitest';
import { toIso, toLocalInput } from './datetime';

describe('datetime venue timezone handling', () => {
  it('converts ISO string to venue local input (Vietnam UTC+7)', () => {
    // 12:00 UTC = 19:00 in Asia/Ho_Chi_Minh
    expect(toLocalInput('2026-11-01T12:00:00.000Z', 'Asia/Ho_Chi_Minh')).toBe('2026-11-01T19:00');
    // 02:00 UTC = 09:00 in Asia/Ho_Chi_Minh
    expect(toLocalInput('2026-11-01T02:00:00.000Z', 'Asia/Ho_Chi_Minh')).toBe('2026-11-01T09:00');
  });

  it('converts venue local input to UTC ISO string (Vietnam UTC+7)', () => {
    // 19:00 in Asia/Ho_Chi_Minh = 12:00 UTC
    expect(toIso('2026-11-01T19:00', 'Asia/Ho_Chi_Minh')).toBe('2026-11-01T12:00:00.000Z');
    // 09:00 in Asia/Ho_Chi_Minh = 02:00 UTC
    expect(toIso('2026-11-01T09:00', 'Asia/Ho_Chi_Minh')).toBe('2026-11-01T02:00:00.000Z');
  });

  it('supports other timezones such as America/New_York (UTC-4 in Oct)', () => {
    // 19:00 in America/New_York (EDT, UTC-4) = 23:00 UTC
    expect(toIso('2026-10-15T19:00', 'America/New_York')).toBe('2026-10-15T23:00:00.000Z');
    expect(toLocalInput('2026-10-15T23:00:00.000Z', 'America/New_York')).toBe('2026-10-15T19:00');
  });

  it('round-trips between local input and ISO string accurately', () => {
    const tz = 'Asia/Ho_Chi_Minh';
    const local = '2026-12-25T20:30';
    const iso = toIso(local, tz);
    expect(toLocalInput(iso, tz)).toBe(local);
  });

  it('handles null, undefined, and empty inputs gracefully', () => {
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput(undefined)).toBe('');
    expect(toLocalInput('')).toBe('');
    expect(toLocalInput('invalid-date')).toBe('');

    expect(toIso(null)).toBeNull();
    expect(toIso(undefined)).toBeNull();
    expect(toIso('')).toBeNull();
    expect(toIso('invalid')).toBeNull();
  });
});
