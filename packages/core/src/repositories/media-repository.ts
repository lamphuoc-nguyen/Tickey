import { z } from 'zod';
import { HttpClient } from '../api/http-client';

export const uploadPurposeSchema = z.enum(['EVENT_ASSET', 'REPORT_EVIDENCE', 'KYC']);
const httpUrl = z.url().refine((value) => /^https?:\/\//i.test(value));
export const uploadedMediaSchema = z
  .object({
    bucket: z.enum(['event-assets', 'report-evidence', 'kyc-private']),
    path: z.string().min(1),
    public_url: httpUrl.nullable(),
  })
  .refine((value) =>
    value.bucket === 'event-assets' ? value.public_url !== null : value.public_url === null,
  );
const privateAccessSchema = z
  .object({
    url: httpUrl,
    expires_at: z.iso.datetime({ offset: true }),
  })
  .transform(({ url, expires_at }) => ({ url, expiresAt: expires_at }));

/** A common upload boundary; provider choice and private-file authorization remain on the API. */
export class HttpMediaRepository {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  upload(form: FormData) {
    return this.http.request('/api/uploads', uploadedMediaSchema, {
      method: 'POST',
      form,
      authenticated: true,
    });
  }

  /** Request on demand. Do not persist the bearer URL in database records or offline/shared caches. */
  privateAccess(input: { purpose: 'KYC' | 'REPORT_EVIDENCE'; path: string }, signal?: AbortSignal) {
    const body = z
      .object({
        purpose: z.enum(['KYC', 'REPORT_EVIDENCE']),
        path: z.string().min(1).max(512),
      })
      .parse(input);
    return this.http.request('/api/uploads/access', privateAccessSchema, {
      method: 'POST',
      body,
      authenticated: true,
      signal,
    });
  }
}
