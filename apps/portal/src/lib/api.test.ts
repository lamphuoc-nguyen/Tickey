import { describe, expect, it } from 'vitest';
import { resolveApiUrl } from './api';

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
