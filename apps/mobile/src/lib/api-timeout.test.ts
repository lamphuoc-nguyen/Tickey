import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@event/core';
import { z } from 'zod';
import { apiRequestTimeout } from './api-timeout';

const apiUrl = 'https://tickey-api.onrender.com';
const auth = {
  auth: { getSession: async () => ({ data: { session: null }, error: null }) },
} as unknown as ConstructorParameters<typeof HttpClient>[1];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Mobile REST timeout for sleeping Render services', () => {
  it('keeps local and other hosts on the normal timeout', () => {
    for (const url of [
      undefined,
      'bad',
      'http://10.0.2.2:5080',
      'https://api.example.com',
      'https://onrender.com.example.org',
    ])
      expect(apiRequestTimeout(url)).toBe(20_000);
    expect(apiRequestTimeout(apiUrl + '/')).toBe(90_000);
  });

  it('allows a real HTTP response after a cold start longer than the normal 20 seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      (_url: string, options: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => resolve(new Response('[]', { status: 200 })), 45_000);
          options.signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new Error('aborted'));
            },
            { once: true },
          );
        }),
    );
    const request = new HttpClient(apiUrl, auth, apiRequestTimeout(apiUrl)).request(
      '/api/events',
      z.array(z.unknown()),
    );
    const assertion = expect(request).resolves.toEqual([]);
    await vi.advanceTimersByTimeAsync(45_000);
    await assertion;
  });

  it('still stops an unresponsive Render request and preserves a retryable error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    );
    const request = new HttpClient(apiUrl, auth, apiRequestTimeout(apiUrl)).request(
      '/api/events',
      z.unknown(),
    );
    const assertion = expect(request).rejects.toMatchObject({
      code: 'NETWORK',
      details: { reason: 'REQUEST_TIMEOUT' },
    });
    await vi.advanceTimersByTimeAsync(90_000);
    await assertion;
  });
});
