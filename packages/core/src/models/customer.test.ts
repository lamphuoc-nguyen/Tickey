import { describe, expect, it } from 'vitest';
import {
  bankInputSchema,
  credentialMatchesTicket,
  preferencesSchema,
  profileSchema,
  ticketSchema,
} from './customer';
import { layoutSchema, availabilitySchema, formatSessionTime } from './catalog';
import { mapDatabaseJson } from './database-mapper';

describe('database response mapping', () => {
  it('displays the same UTC session in its venue timezone with Figma date order', () => {
    expect(formatSessionTime('2026-10-24T12:30:00Z', 'Asia/Ho_Chi_Minh')).toBe('24/10/2026 · 19:30');
    expect(formatSessionTime('2026-10-24T12:30:00Z', 'UTC')).toBe('24/10/2026 · 12:30');
  });
  it('maps snake_case including numbered reminder names and nested relations', () => {
    expect(
      preferencesSchema.parse({
        push_enabled: true,
        email_enabled: false,
        reminder_24h: true,
        reminder_2h: false,
      }),
    ).toEqual({ pushEnabled: true, emailEnabled: false, reminder24h: true, reminder2h: false });
    expect(mapDatabaseJson({ session_id: 'session', event: { cover_image_url: 'image' } })).toEqual({
      sessionId: 'session',
      event: { coverImageUrl: 'image' },
    });
  });
  it('accepts a nullable profile name instead of hiding a valid account response', () => {
    expect(
      profileSchema.parse({
        id: 'id',
        full_name: null,
        phone: null,
        avatar_url: null,
        locale: 'vi',
        email: null,
        created_at: 'today',
      }).fullName,
    ).toBeNull();
  });
  it('preserves database UUIDs and sparse unavailable seats', () => {
    expect(
      layoutSchema.parse({
        session_id: 'session',
        layout_version_id: 'v',
        version: 1,
        timezone: 'Asia/Ho_Chi_Minh',
        zones: [
          {
            id: 'uuid-zone',
            code: 'A',
            name: 'A',
            type: 'seated',
            capacity: 1,
            color: null,
            seats: [
              { id: 'uuid-seat', code: 'A01', row: 'A', number: '01', x: 0, y: 0, flags: [], section: null },
            ],
          },
        ],
      }).zones[0]?.seats[0]?.id,
    ).toBe('uuid-seat');
    expect(
      availabilitySchema.parse({
        server_now: 'now',
        session_status: 'ON_SALE',
        sales_paused: false,
        unavailable_seats: {},
        zones: [],
        ticket_types: [],
      }).unavailableSeats,
    ).toEqual({});
  });
  it('keeps the worker-signed payload byte-for-byte and checks ticket binding', () => {
    const payload = '{ "v": 1, "tid": "ticket", "sid": "session", "kid": "dev-1" }';
    const ticket = ticketSchema.parse({
      id: 'ticket',
      booking_id: 'booking',
      session_id: 'session',
      ticket_type_id: 'type',
      zone_id: null,
      seat_id: null,
      holder_name: null,
      holder_email: null,
      holder_phone: null,
      status: 'ISSUED',
      used_at: null,
      issued_at: null,
      credential: [{ kid: 'dev-1', payload, signature: 'server-signature' }],
      seat: null,
      ticket_type: null,
      session: null,
    });
    expect(ticket.credential?.payload).toBe(payload);
    expect(credentialMatchesTicket(ticket)).toBe(true);
    expect(credentialMatchesTicket({ ...ticket, id: 'different-ticket' })).toBe(false);
  });
  it('validates bank input before the OTP-gated submission', () => {
    expect(
      bankInputSchema.safeParse({ bankCode: 'VCB', accountNumber: '1234', accountHolder: 'NGUYEN HUU GIAU' })
        .success,
    ).toBe(false);
  });
});
