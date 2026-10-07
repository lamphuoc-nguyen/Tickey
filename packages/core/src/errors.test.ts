import { describe, expect, it } from 'vitest';
import { ApiError, SeatConflictError } from './errors';

describe('ApiError.fromPostgrest', () => {
  it('maps SEAT_CONFLICT to SeatConflictError with the conflicting seats', () => {
    const e = ApiError.fromPostgrest({ message: 'SEAT_CONFLICT', details: '{"seat_ids":["s1","s2"]}' });
    expect(e).toBeInstanceOf(SeatConflictError);
    expect((e as SeatConflictError).seatIds).toEqual(['s1', 's2']);
  });

  it('keeps the code and parsed details of a known error', () => {
    const e = ApiError.fromPostgrest({
      message: 'INVALID_STATE',
      details: '{"reason":"BANK_ACCOUNT_COOLDOWN"}',
    });
    expect(e.code).toBe('INVALID_STATE');
    expect(e.details).toEqual({ reason: 'BANK_ACCOUNT_COOLDOWN' });
  });

  it('treats unknown messages and empty details safely', () => {
    const e = ApiError.fromPostgrest({ message: 'permission denied for table bookings', details: '' });
    expect(e.code).toBe('UNKNOWN');
    expect(e.details).toEqual({});
    expect(e.message).toContain('permission denied');
  });
});
