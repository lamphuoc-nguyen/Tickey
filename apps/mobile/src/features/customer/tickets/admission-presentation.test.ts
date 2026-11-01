import { expect, it } from 'vitest';
import { type Admission, type Ticket } from '@event/core';
import {
  admissionPollingInterval,
  admissionPresentation,
  canSaveBookingPass,
} from './admission-presentation';

const admission: Admission = {
  bookingId: 'booking-a',
  status: 'CONFIRMED',
  qr: 'server-signed-qr',
  total: 5,
  used: 0,
  remaining: 5,
};
const view = (changes: Partial<Parameters<typeof admissionPresentation>[0]> = {}) =>
  admissionPresentation({ bookingId: 'booking-a', status: 'CONFIRMED', admission, online: true, ...changes });

it('waits for issuance and then displays exactly the server QR for five entries', () => {
  expect(view({ status: 'PAID', admission: undefined })).toMatchObject({
    qr: null,
    eligible: false,
    description: 'Đang phát hành vé',
  });
  expect(view({ admission: { ...admission, qr: null } })).toMatchObject({
    qr: null,
    description: 'Đang cập nhật mã vào cổng.',
  });
  expect(view()).toMatchObject({ qr: admission.qr, used: 0, remaining: 5 });
});

it('uses server counts after two people enter and hides QR when all entries are consumed', () => {
  expect(view({ admission: { ...admission, used: 2, remaining: 3 } })).toMatchObject({
    qr: admission.qr,
    used: 2,
    remaining: 3,
  });
  expect(view({ admission: { ...admission, used: 5, remaining: 0 } })).toMatchObject({
    qr: null,
    description: 'Đơn đã dùng hết lượt vào cổng.',
  });
});

it('does not call cancelled/refunded/unused expired entries successful admission', () => {
  expect(view({ admission: { ...admission, status: 'REFUNDED' } })).toMatchObject({
    qr: null,
    eligible: false,
  });
  expect(view({ cancelled: true }).qr).toBeNull();
  expect(view({ admission: { ...admission, used: 2, remaining: 0 } }).description).toBe(
    'Đơn không còn lượt vào cổng.',
  );
});

it('prefers a fresh admission cancellation and never reuses a different booking QR', () => {
  expect(view({ admission: { ...admission, status: 'CANCELLED' } }).qr).toBeNull();
  expect(view({ admission: { ...admission, bookingId: 'booking-b' }, savedQr: 'cached-qr' })).toMatchObject({
    qr: null,
    used: undefined,
    remaining: undefined,
  });
});

it('does not fall back to saved QR when the live response explicitly has no code', () => {
  expect(view({ admission: { ...admission, qr: null }, savedQr: 'old-code' }).qr).toBeNull();
});

it('keeps counters unknown after a read error and respects a newer cancelled booking', () => {
  expect(view({ failed: true })).toMatchObject({ used: undefined, remaining: undefined });
  expect(view({ failed: true, status: 'CANCELLED' }).qr).toBeNull();
  expect(view({ failed: true, admission: undefined }).description).toContain('Chưa thể tải');
});

it('shows a downloaded server credential offline without claiming live counters', () => {
  expect(view({ online: false, status: undefined, savedQr: 'downloaded-server-qr' })).toMatchObject({
    qr: 'downloaded-server-qr',
    used: undefined,
    remaining: undefined,
  });
  expect(view({ online: false, status: undefined }).qr).toBeNull();
});

it('polls for delayed QR and active entry counts, but stops on terminal status or errors', () => {
  expect(admissionPollingInterval({ ...admission, qr: null })).toBe(3000);
  expect(admissionPollingInterval(admission)).toBe(5000);
  expect(admissionPollingInterval({ ...admission, remaining: 0 })).toBe(false);
  expect(admissionPollingInterval({ ...admission, status: 'REFUNDED' })).toBe(false);
  expect(admissionPollingInterval(admission, new Error('network'))).toBe(false);
});

it('only enables download for matching tickets with an issued server QR and remaining entries', () => {
  const tickets = [{ bookingId: 'booking-a' }] as Ticket[];
  expect(canSaveBookingPass('booking-a', tickets, admission)).toBe(true);
  expect(canSaveBookingPass('booking-a', tickets, { ...admission, qr: null })).toBe(false);
  expect(canSaveBookingPass('booking-a', tickets, { ...admission, remaining: 0 })).toBe(false);
  expect(canSaveBookingPass('booking-a', [], admission)).toBe(false);
  expect(canSaveBookingPass('booking-b', tickets, admission)).toBe(false);
  expect(canSaveBookingPass('booking-a', [{ bookingId: 'booking-b' }] as Ticket[], admission)).toBe(false);
});
