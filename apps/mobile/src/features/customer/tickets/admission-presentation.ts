import type { Admission, BookingStatus, Ticket } from '@event/core';
import { bookingAdmissionState } from './booking-pass';

const issuedStatuses: readonly BookingStatus[] = ['CONFIRMED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED'];

/** All counters and the encoded QR come from this booking's server response. */
export function admissionPresentation(input: {
  bookingId?: string;
  status?: BookingStatus;
  admission?: Admission;
  savedQr?: string;
  online: boolean;
  failed?: boolean;
  cancelled?: boolean;
}) {
  const current =
    input.online && input.admission?.bookingId === input.bookingId ? input.admission : undefined;
  const status = (!input.failed ? current?.status : undefined) ?? input.status ?? current?.status;
  const eligible = !input.cancelled && (status ? issuedStatuses.includes(status) : !input.online);
  const exhausted = !!current && current.remaining === 0;
  const qr = eligible && !exhausted ? ((input.online ? current?.qr : input.savedQr) ?? null) : null;
  const fallback = bookingAdmissionState(status);
  const description = input.cancelled
    ? 'Suất diễn đã bị hủy.'
    : !eligible
      ? fallback.title
      : exhausted
        ? current.used === current.total && current.total > 0
          ? 'Đơn đã dùng hết lượt vào cổng.'
          : 'Đơn không còn lượt vào cổng.'
        : qr
          ? 'QR cho cả đơn'
          : !input.online
            ? 'Đơn này chưa có mã QR được lưu trên thiết bị.'
            : input.failed
              ? 'Chưa thể tải mã vào cổng. Vui lòng thử lại.'
              : current
                ? 'Đang cập nhật mã vào cổng.'
                : 'Đang tải mã vào cổng.';
  return {
    status,
    eligible,
    qr,
    description,
    total: current?.total,
    used: !input.failed ? current?.used : undefined,
    remaining: !input.failed ? current?.remaining : undefined,
  };
}

/** Poll reads only; TanStack Query pauses intervals when the app is in the background/offline. */
export function admissionPollingInterval(admission?: Admission, error?: unknown): number | false {
  if (!admission || error || !issuedStatuses.includes(admission.status)) return false;
  if (admission.remaining === 0) return false;
  return admission.qr ? 5000 : 3000;
}

export function canSaveBookingPass(
  bookingId: string,
  tickets: readonly Ticket[],
  admission?: Admission,
): boolean {
  return (
    !!admission?.qr &&
    admission.bookingId === bookingId &&
    issuedStatuses.includes(admission.status) &&
    admission.remaining > 0 &&
    tickets.length > 0 &&
    tickets.every((ticket) => ticket.bookingId === bookingId)
  );
}
