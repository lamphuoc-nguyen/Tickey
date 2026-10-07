// Error contract: supabase/README.md "Mã lỗi" and MT §20.4.
// RPCs raise `app_error(code, detail)`: PostgREST returns message = code, details = JSON text.

export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'INVALID_STATE',
  'SESSION_NOT_ON_SALE',
  'SEAT_CONFLICT',
  'SOLD_OUT',
  'LIMIT_EXCEEDED',
  'BOOKING_EXPIRED',
  'MFA_REQUIRED',
  'OTP_REQUIRED',
  'DEVICE_REVOKED',
  'IMMUTABLE_ROW',
  'LEDGER_UNBALANCED',
  'LEDGER_INVALID_LINES',
] as const;

export type AppErrorCode = (typeof ERROR_CODES)[number];
/** UNKNOWN: unexpected server error; NETWORK: request never got an answer (retry, never treat as payment failure). */
export type ErrorCode = AppErrorCode | 'UNKNOWN' | 'NETWORK';

export interface PostgrestLikeError {
  message: string;
  details?: string | null;
  code?: string;
  hint?: string | null;
}

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: ErrorCode, details: Record<string, unknown> = {}, message?: string) {
    super(message ?? code);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }

  static fromPostgrest(error: PostgrestLikeError): ApiError {
    const code = (ERROR_CODES as readonly string[]).includes(error.message)
      ? (error.message as AppErrorCode)
      : 'UNKNOWN';
    const details = parseDetails(error.details);
    if (code === 'SEAT_CONFLICT') {
      const seatIds = Array.isArray(details.seat_ids) ? (details.seat_ids as string[]) : [];
      return new SeatConflictError(seatIds, details);
    }
    return new ApiError(code, details, code === 'UNKNOWN' ? error.message : undefined);
  }
}

export class SeatConflictError extends ApiError {
  readonly seatIds: string[];

  constructor(seatIds: string[], details: Record<string, unknown> = {}) {
    super('SEAT_CONFLICT', details);
    this.name = 'SeatConflictError';
    this.seatIds = seatIds;
  }
}

function parseDetails(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { value: parsed };
  } catch {
    return { raw };
  }
}
