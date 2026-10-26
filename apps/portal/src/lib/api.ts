import { ApiError, HttpClient, mapDatabaseJson } from '@event/core';
import { z } from 'zod';
import { supabase } from './supabase';
import { useSession } from './use-session';

// Pages write only through the .NET API with the caller's JWT; RLS + RPCs decide what is allowed (MT §7.1).
const json = z.unknown();

export const resolveApiUrl = (customEnvUrl?: string | null): string => {
  const url = customEnvUrl !== undefined ? customEnvUrl : import.meta.env.VITE_API_URL;
  if (url && url.trim()) return url.trim();
  throw new Error('Missing API URL: VITE_API_URL environment variable is not configured.');
};

async function call<T>(method: string, path: string, body?: unknown, form?: FormData): Promise<T> {
  const client = new HttpClient(resolveApiUrl(), supabase);
  const data = await client.request(path, json, { method, body, form, authenticated: true });
  return mapDatabaseJson(data) as T;
}

/** /api calls. Responses are the database JSON with keys in camelCase. */
export const api = {
  get: <T>(path: string) => call<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => call<T>('POST', path, body),
  put: <T>(path: string, body: unknown = {}) => call<T>('PUT', path, body),
  delete: <T>(path: string) => call<T>('DELETE', path),
  /** POST /api/uploads: EVENT_ASSET and KYC go to the Org's folder. */
  upload: (file: File, purpose: 'EVENT_ASSET' | 'KYC' | 'REPORT_EVIDENCE', orgId?: string | null) => {
    const form = new FormData();
    form.append('file', file);
    form.append('purpose', purpose);
    if (orgId) form.append('orgId', orgId);
    return call<{ path: string; publicUrl: string | null }>('POST', '/api/uploads', undefined, form);
  },
};

/** The organization of the active ORG workspace (null for Admin / not signed in). */
export function useOrgId(): string | null {
  return useSession().workspace.orgId ?? null;
}

const DEFAULT_ERROR_MESSAGE = 'Không thể hoàn tất yêu cầu. Vui lòng thử lại hoặc liên hệ hỗ trợ.';

const messages: Record<ApiError['code'], string> = {
  NETWORK: 'Không thể kết nối máy chủ. Kiểm tra mạng và thử lại.',
  UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  FORBIDDEN: 'Tài khoản không có quyền thực hiện thao tác này.',
  MFA_REQUIRED: 'Thao tác cần xác thực bổ sung. Vui lòng liên hệ hỗ trợ.',
  NOT_FOUND: 'Không tìm thấy dữ liệu.',
  INVALID_STATE: 'Thao tác không còn phù hợp với trạng thái hiện tại.',
  VALIDATION_FAILED: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra và thử lại.',
  SESSION_NOT_ON_SALE: 'Suất diễn hiện không mở bán.',
  SEAT_CONFLICT: 'Một số ghế đã có người chọn hoặc không còn khả dụng.',
  SOLD_OUT: 'Khu vực hoặc hạng vé đã hết chỗ.',
  LIMIT_EXCEEDED: 'Vượt giới hạn cho phép.',
  BOOKING_EXPIRED: 'Đã hết thời gian giữ chỗ.',
  OTP_REQUIRED: 'Cần xác thực mã OTP trước khi tiếp tục.',
  DEVICE_REVOKED: 'Thiết bị đã bị thu hồi.',
  IMMUTABLE_ROW: 'Dữ liệu đã chốt, không thể sửa.',
  LEDGER_UNBALANCED: 'Giao dịch sổ cái không cân bằng.',
  LEDGER_INVALID_LINES: 'Bút toán sổ cái chưa hợp lệ.',
  RATE_LIMITED: 'Bạn đã thực hiện quá nhiều thao tác. Vui lòng chờ giây lát rồi thử lại.',
  UNKNOWN: DEFAULT_ERROR_MESSAGE,
};

/** Vietnamese message for an API / network error, for toasts and inline notices. */
export function errorMessage(error: unknown): string {
  if (
    error instanceof ApiError ||
    (typeof error === 'object' && error !== null && ('code' in error || (error as Error).name === 'ApiError'))
  ) {
    const code = (error as { code?: ApiError['code'] }).code;
    if (code && messages[code]) return messages[code];
    const msg = (error as Error).message;
    if (msg && msg !== 'UNKNOWN' && !code) return msg;
    return DEFAULT_ERROR_MESSAGE;
  }
  if (error instanceof Error && error.message) {
    if (error.message === 'UNKNOWN') return DEFAULT_ERROR_MESSAGE;
    return error.message;
  }
  return 'Có lỗi xảy ra. Vui lòng thử lại.';
}

/** dd/MM/yyyy HH:mm in the venue's timezone (Vietnam time when unknown). */
export function formatDateTime(value: string | null | undefined, timeZone = 'Asia/Ho_Chi_Minh'): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatVnd(amount: number | null | undefined): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount ?? 0)}đ`;
}
