import { describe, expect, it } from 'vitest';
import type { Ticket } from '@event/core';
import { reminderPlan } from './reminder-plan';
describe('local reminder planning', () => {
  it('deduplicates tickets in one session and excludes cancelled/void tickets', () => {
    const preferences = { pushEnabled: true, emailEnabled: true, reminder24h: true, reminder2h: true };
    const session = {
      id: 's',
      status: 'ON_SALE',
      startsAt: '2026-10-24T12:30:00Z',
      event: { title: 'Đêm nhạc' },
    };
    const tickets = [
      { status: 'ISSUED', session },
      { status: 'ISSUED', session },
      { status: 'ISSUED', session: { ...session, id: 'cancelled', status: 'CANCELLED' } },
      { status: 'VOID', session },
    ] as Ticket[];
    expect(reminderPlan(tickets, preferences, Date.parse('2026-10-14T00:00:00Z'))).toHaveLength(2);
    expect(reminderPlan(tickets, { ...preferences, pushEnabled: false }, 0)).toEqual([]);
    expect(reminderPlan(tickets, preferences, Date.parse('2026-10-25T00:00:00Z'))).toEqual([]);
  });
});
