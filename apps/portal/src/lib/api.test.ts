import { describe, expect, it } from 'vitest';
import { ApiError, ERROR_CODES } from '@event/core';
import { errorMessage, resolveApiUrl } from './api';

describe('resolveApiUrl', () => {
  it('returns trimmed URL when valid env variable is provided', () => {
    expect(resolveApiUrl('http://localhost:5080')).toBe('http://localhost:5080');
    expect(resolveApiUrl('  https://api.example.com  ')).toBe('https://api.example.com');
  });

  it('throws a configuration error when VITE_API_URL is missing or blank', () => {
    expect(() => resolveApiUrl('')).toThrow('Missing API URL');
    expect(() => resolveApiUrl('   ')).toThrow('Missing API URL');
    expect(() => resolveApiUrl(null)).toThrow('Missing API URL');
  });
});

describe('errorMessage (F-06)', () => {
  it('maps every single code in ERROR_CODES to friendly Vietnamese message different from raw code', () => {
    for (const code of ERROR_CODES) {
      const err = new ApiError(code);
      const msg = errorMessage(err);
      expect(msg).not.toBe(code);
      expect(msg.length).toBeGreaterThan(5);
    }
  });

  it('provides expected message for MFA_REQUIRED matching P1 direction without mandatory 2FA', () => {
    const err = new ApiError('MFA_REQUIRED');
    expect(errorMessage(err)).toBe('Thao tác cần xác thực bổ sung. Vui lòng liên hệ hỗ trợ.');
  });

  it('maps NETWORK and UNKNOWN properly', () => {
    expect(errorMessage(new ApiError('NETWORK'))).toBe('Không thể kết nối máy chủ. Kiểm tra mạng và thử lại.');
    expect(errorMessage(new ApiError('UNKNOWN'))).toBe(
      'Không thể hoàn tất yêu cầu. Vui lòng thử lại hoặc liên hệ hỗ trợ.',
    );
    expect(errorMessage(new ApiError('UNKNOWN', {}, 'UNKNOWN'))).toBe(
      'Không thể hoàn tất yêu cầu. Vui lòng thử lại hoặc liên hệ hỗ trợ.',
    );
    expect(errorMessage(new Error('UNKNOWN'))).toBe(
      'Không thể hoàn tất yêu cầu. Vui lòng thử lại hoặc liên hệ hỗ trợ.',
    );
  });

  it('handles standard Error and fallback unknown objects', () => {
    expect(errorMessage(new Error('Lỗi tùy biến'))).toBe('Lỗi tùy biến');
    expect(errorMessage(null)).toBe('Có lỗi xảy ra. Vui lòng thử lại.');
  });
});
