import { afterEach, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpClient } from '../api/http-client';
import { HttpMediaRepository } from './media-repository';

const auth = {
  auth: { getSession: async () => ({ data: { session: { access_token: 'test-jwt' } }, error: null }) },
} as unknown as SupabaseClient;
const repository = () => new HttpMediaRepository(new HttpClient('http://api.test', auth));
afterEach(() => vi.unstubAllGlobals());

it('uploads multipart as the caller and retains private logical paths without exposing a public URL', async () => {
  const payload = { bucket: 'report-evidence', path: 'owner/cloudinary/object.png', public_url: null };
  const fetcher = vi.fn(async () => new Response(JSON.stringify(payload), { status: 201 }));
  vi.stubGlobal('fetch', fetcher);
  const form = new FormData();
  form.append('purpose', 'REPORT_EVIDENCE');
  await expect(repository().upload(form)).resolves.toEqual(payload);
  expect(fetcher).toHaveBeenCalledWith(
    'http://api.test/api/uploads',
    expect.objectContaining({
      method: 'POST',
      body: form,
      headers: { Authorization: 'Bearer test-jwt' },
    }),
  );
});

it('requests a fresh private URL through the API and maps its expiry', async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          url: 'https://api.cloudinary.com/test/image/download?signature=test',
          expires_at: '2026-10-21T12:00:00Z',
        }),
        { status: 200 },
      ),
  );
  vi.stubGlobal('fetch', fetcher);
  const input = { purpose: 'KYC' as const, path: 'owner/cloudinary/image.png' };
  await expect(repository().privateAccess(input)).resolves.toEqual({
    url: 'https://api.cloudinary.com/test/image/download?signature=test',
    expiresAt: '2026-10-21T12:00:00Z',
  });
  await repository().privateAccess(input);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher).toHaveBeenCalledWith(
    'http://api.test/api/uploads/access',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(input),
      headers: expect.objectContaining({ Authorization: 'Bearer test-jwt' }),
    }),
  );
});

it.each([401, 403, 502])('keeps HTTP %s as an error, never substitutes a public link', async (status) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status })),
  );
  await expect(repository().privateAccess({ purpose: 'KYC', path: 'org/image.png' })).rejects.toBeDefined();
});

it('rejects an incomplete signed-link response', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{"url":"https://example.test/a"}', { status: 200 })),
  );
  await expect(repository().privateAccess({ purpose: 'KYC', path: 'org/image.png' })).rejects.toMatchObject({
    code: 'UNKNOWN',
    details: { reason: 'INVALID_RESPONSE' },
  });
});

it('does not accept a private upload response with a public URL', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            bucket: 'kyc-private',
            path: 'org/cloudinary/private.png',
            public_url: 'https://res.cloudinary.com/public.png',
          }),
          { status: 201 },
        ),
    ),
  );
  await expect(repository().upload(new FormData())).rejects.toMatchObject({ code: 'UNKNOWN' });
});

it('does not accept an executable signed-link URL', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            url: 'javascript:alert(1)',
            expires_at: '2026-10-21T12:00:00Z',
          }),
          { status: 200 },
        ),
    ),
  );
  await expect(repository().privateAccess({ purpose: 'KYC', path: 'org/image.png' })).rejects.toMatchObject({
    code: 'UNKNOWN',
    details: { reason: 'INVALID_RESPONSE' },
  });
});
