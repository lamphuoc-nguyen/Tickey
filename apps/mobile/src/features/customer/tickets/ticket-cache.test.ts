import { describe, expect, it } from 'vitest';
import { ticketSchema } from '@event/core';
import { TicketCache } from './ticket-cache';
describe('genuine ticket snapshots', () => {
  it('does not write a late booking QR after the account changes during the storage read', async () => {
    const rows = new Map<string, string>();
    let pause = false;
    let releaseRead!: () => void;
    let notifyRead!: () => void;
    const started = new Promise<void>((resolve) => {
      notifyRead = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const cache = new TicketCache({
      getItem: async (key) => {
        if (pause && key === 'tickey:admissions:v1:account-a') {
          notifyRead();
          await blocked;
        }
        return rows.get(key) ?? null;
      },
      setItem: async (key, value) => {
        rows.set(key, value);
      },
      removeItem: async (key) => {
        rows.delete(key);
      },
    });
    cache.activate('account-a');
    await cache.saveAdmission('account-a', 'previous-booking', 'existing-server-qr');
    pause = true;
    const saving = cache.saveAdmission('account-a', 'new-booking', 'late-server-qr');
    const failure = expect(saving).rejects.toThrow('Tài khoản đã thay đổi.');
    await started;
    cache.activate('account-b');
    releaseRead();
    await failure;
    expect(JSON.parse(rows.get('tickey:admissions:v1:account-a')!)).toEqual({
      'previous-booking': 'existing-server-qr',
    });
    expect(await cache.admissions('account-b')).toEqual({});
  });
  it('isolates accounts, keeps timestamps and clears downloads on logout', async () => {
    const rows = new Map<string, string>();
    rows.set('other-feature-pending-sentinel', 'preserve');
    const cache = new TicketCache({
      getItem: async (key) => rows.get(key) ?? null,
      setItem: async (key, value) => {
        rows.set(key, value);
      },
      removeItem: async (key) => {
        rows.delete(key);
      },
    });
    const ticket = ticketSchema.parse({
      id: 'one',
      booking_id: 'booking',
      session_id: 'session',
      ticket_type_id: 'type',
      zone_id: null,
      seat_id: null,
      holder_name: null,
      holder_email: null,
      holder_phone: null,
      status: 'VOID',
      used_at: null,
      issued_at: null,
      credential: null,
      seat: null,
      ticket_type: null,
      session: null,
    });
    cache.activate('account-a');
    await cache.save('account-a', ticket, '2026-10-14T00:00:00Z');
    expect(await cache.list('account-b')).toEqual([]);
    expect((await cache.list('account-a'))[0]).toMatchObject({
      ticket: { status: 'VOID' },
      downloadedAt: '2026-10-14T00:00:00Z',
    });
    await Promise.all([
      cache.save('account-a', { ...ticket, id: 'two' }, '2026-10-14T00:01:00Z'),
      cache.save('account-a', { ...ticket, id: 'three' }, '2026-10-14T00:01:00Z'),
    ]);
    expect((await cache.list('account-a')).map((saved) => saved.ticket.id)).toEqual(['one', 'two', 'three']);
    await cache.saveAdmission('account-a', 'booking', 'eyJ2IjoyfQ.sig');
    expect(await cache.admissions('account-a')).toEqual({ booking: 'eyJ2IjoyfQ.sig' });
    expect(await cache.admissions('account-b')).toEqual({});
    await cache.clear('account-a');
    expect(rows.get('other-feature-pending-sentinel')).toBe('preserve');
    expect(await cache.list('account-a')).toEqual([]);
    expect(await cache.admissions('account-a')).toEqual({});
    cache.activate('account-b');
    await expect(cache.save('account-a', ticket, '2026-10-14T00:00:00Z')).rejects.toThrow(
      'Tài khoản đã thay đổi.',
    );
    await expect(cache.saveAdmission('account-a', 'booking', 'qr')).rejects.toThrow('Tài khoản đã thay đổi.');
  });
});
