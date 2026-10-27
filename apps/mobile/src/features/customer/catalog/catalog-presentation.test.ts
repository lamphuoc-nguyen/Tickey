import { describe, expect, it } from 'vitest';
import { eventSchema, sessionSchema } from '@event/core';
import { homeSections, nextEventDate, sessionChoices } from './catalog-presentation';

const event = (id: string, sessions: unknown[] = []) =>
  eventSchema.parse({
    id,
    tenant_id: 'tenant',
    title: id,
    slug: id,
    summary: null,
    cover_image_url: null,
    category_id: null,
    age_limit: null,
    is_featured: true,
    status: 'PUBLISHED',
    sessions,
  });
const session = (id: string, status = 'ON_SALE', paused = false, starts = '2026-11-01T10:00:00Z') =>
  sessionSchema.parse({
    id,
    title: null,
    starts_at: starts,
    ends_at: '2026-11-01T12:00:00Z',
    status,
    event_id: 'event',
    doors_open_at: starts,
    sales_start_at: '2026-10-01T00:00:00Z',
    sales_end_at: starts,
    sales_paused: paused,
    max_tickets_per_account: 5,
    venue: null,
  });
describe('Customer discovery presentation', () => {
  it('caps banner navigation at five distinct real events and avoids repeats in discovery', () => {
    const events = Array.from({ length: 7 }, (_, i) => event(String(i)));
    const result = homeSections(events, [events[0]!, ...events]);
    expect(result.banners.map((item) => item.id)).toEqual(['0', '1', '2', '3', '4']);
    expect(result.discovery.map((item) => item.id)).toEqual(['5', '6']);
    expect(events).toHaveLength(7);
  });
  it('does not refill an exhausted discovery rail with duplicate featured events', () => {
    const only = event('only');
    expect(homeSections([only, only], [only])).toEqual({ banners: [only], discovery: [] });
    expect(homeSections([], [])).toEqual({ banners: [], discovery: [] });
  });
  it('shows the earliest known upcoming date, without promising that tickets are on sale', () => {
    const sessions = [
      { id: 'late', title: null, status: 'ON_SALE', starts_at: '2026-11-02T10:00:00Z' },
      { id: 'closed', title: null, status: 'SALES_CLOSED', starts_at: '2026-11-01T10:00:00Z' },
    ];
    const value = event('one', sessions);
    expect(nextEventDate(value, Date.parse('2026-10-26T00:00:00Z'))).toBe('2026-11-01T10:00:00Z');
    expect(value.sessions?.[0]?.id).toBe('late');
  });
  it('does not advertise cancelled, postponed, ended, past or invalid dates as upcoming', () => {
    const values = ['CANCELLED', 'POSTPONED', 'ENDED'].map((status) => ({
      id: status,
      title: null,
      status,
      starts_at: '2026-11-01T10:00:00Z',
    }));
    values.push(
      { id: 'past', title: null, status: 'ON_SALE', starts_at: '2026-01-01T00:00:00Z' },
      { id: 'invalid', title: null, status: 'ON_SALE', starts_at: 'invalid' },
    );
    expect(nextEventDate(event('one', values), Date.parse('2026-10-26T00:00:00Z'))).toBeUndefined();
  });
  it('separates selectable dates by actual sale status and pause, not local date guesses', () => {
    const values = [
      session('later', 'ON_SALE', false, '2026-11-02T10:00:00Z'),
      session('paused', 'ON_SALE', true),
      session('closed', 'SALES_CLOSED'),
      session('first'),
    ];
    const result = sessionChoices(values);
    expect(result.available.map((item) => item.id)).toEqual(['first', 'later']);
    expect(result.other.map((item) => item.id)).toEqual(['paused', 'closed']);
    expect(values[0]?.id).toBe('later');
  });
});
