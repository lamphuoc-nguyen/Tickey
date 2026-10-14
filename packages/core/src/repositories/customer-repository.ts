import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpClient, pageQuery } from '../api/http-client';
import { ApiError } from '../errors';
import { authError } from '../api/auth-error';
import {
  bankInputSchema,
  notificationSchema,
  orderSchema,
  preferencesSchema,
  profileSchema,
  refundSchema,
  reportInputSchema,
  reportSchema,
  supportInputSchema,
  supportSchema,
  ticketSchema,
  type NotificationPreferences,
} from '../models/customer';
import { mapDatabaseJson } from '../models/database-mapper';

export class HttpCustomerRepository {
  private readonly http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }
  profile(signal?: AbortSignal) {
    return this.http.request('/api/me', profileSchema, { authenticated: true, signal });
  }
  updateProfile(input: { fullName: string; phone: string }) {
    const body = z
      .object({
        fullName: z.string().trim().min(1),
        phone: z
          .string()
          .trim()
          .regex(/^[+\d\s()-]{0,20}$/),
      })
      .parse(input);
    return this.http.request('/api/me', profileSchema, { method: 'PUT', body, authenticated: true });
  }
  orders(offset = 0, signal?: AbortSignal) {
    return this.http.request(`/api/bookings?${pageQuery({ offset })}`, z.array(orderSchema), {
      authenticated: true,
      signal,
    });
  }
  tickets(offset = 0, signal?: AbortSignal) {
    return this.http.request(`/api/tickets?${pageQuery({ offset })}`, z.array(ticketSchema), {
      authenticated: true,
      signal,
    });
  }
  ticket(id: string, signal?: AbortSignal) {
    return this.http.request(`/api/tickets/${encodeURIComponent(id)}`, ticketSchema, {
      authenticated: true,
      signal,
    });
  }
  assignHolder(id: string, input: { name: string; email: string | null; phone: string | null }) {
    const body = z
      .object({ name: z.string().trim().min(1), email: z.email().nullable(), phone: z.string().nullable() })
      .parse(input);
    return this.http.request(`/api/tickets/${encodeURIComponent(id)}/holder`, z.null(), {
      method: 'PUT',
      body,
      authenticated: true,
    });
  }
  notifications(offset = 0, signal?: AbortSignal) {
    return this.http.request(`/api/notifications?${pageQuery({ offset })}`, z.array(notificationSchema), {
      authenticated: true,
      signal,
    });
  }
  markRead(ids: string[]) {
    return this.http.request('/api/notifications/read', z.object({ updated: z.number() }), {
      method: 'PUT',
      body: { ids },
      authenticated: true,
    });
  }
  refunds(offset = 0, signal?: AbortSignal) {
    return this.http.request(`/api/refunds?${pageQuery({ offset })}`, z.array(refundSchema), {
      authenticated: true,
      signal,
    });
  }
  bankInfo(id: string, input: z.infer<typeof bankInputSchema>) {
    return this.http.request(
      `/api/refunds/${encodeURIComponent(id)}/bank-info`,
      z.object({ approval_id: z.string().nullable() }).transform(mapDatabaseJson),
      { method: 'POST', body: bankInputSchema.parse(input), authenticated: true },
    );
  }
  reports(offset = 0, signal?: AbortSignal) {
    return this.http.request(`/api/reports?${pageQuery({ offset })}`, z.array(reportSchema), {
      authenticated: true,
      signal,
    });
  }
  submitReport(input: z.input<typeof reportInputSchema>) {
    return this.http.request(
      '/api/reports',
      z.object({ report_id: z.string(), dispute_case_id: z.string() }).transform(mapDatabaseJson),
      { method: 'POST', body: reportInputSchema.parse(input), authenticated: true },
    );
  }
  supportRequests(offset = 0, signal?: AbortSignal) {
    return this.http.request(`/api/support-requests?${pageQuery({ offset })}`, z.array(supportSchema), {
      authenticated: true,
      signal,
    });
  }
  createSupport(input: z.infer<typeof supportInputSchema>) {
    return this.http.request('/api/support-requests', z.object({ id: z.string() }), {
      method: 'POST',
      body: supportInputSchema.parse(input),
      authenticated: true,
    });
  }
  supportMessage(id: string, body: string) {
    return this.http.request(
      `/api/support-requests/${encodeURIComponent(id)}/messages`,
      z.object({ id: z.string() }),
      { method: 'POST', body: { body: z.string().trim().min(1).parse(body) }, authenticated: true },
    );
  }
  uploadEvidence(form: FormData) {
    return this.http.request(
      '/api/uploads',
      z.object({ bucket: z.literal('report-evidence'), path: z.string(), public_url: z.null() }),
      { method: 'POST', form, authenticated: true },
    );
  }
  private async findInPages<T extends { id: string }>(
    id: string,
    load: (offset: number, signal?: AbortSignal) => Promise<T[]>,
    signal?: AbortSignal,
  ): Promise<T> {
    for (let offset = 0; ; offset += 20) {
      const page = await load(offset, signal);
      const found = page.find((row) => row.id === id);
      if (found) return found;
      if (page.length < 20) throw new ApiError('NOT_FOUND');
    }
  }
  refund(id: string, signal?: AbortSignal) {
    return this.findInPages(id, (offset, abort) => this.refunds(offset, abort), signal);
  }
  order(id: string, signal?: AbortSignal) {
    return this.findInPages(id, (offset, abort) => this.orders(offset, abort), signal);
  }
  async bookingTickets(bookingId: string, signal?: AbortSignal) {
    const id = z.uuid().parse(bookingId);
    const matched: z.infer<typeof ticketSchema>[] = [];
    for (let offset = 0; ; offset += 20) {
      const page = await this.tickets(offset, signal);
      matched.push(...page.filter((ticket) => ticket.bookingId === id));
      if (page.length < 20) return matched;
    }
  }
  report(id: string, signal?: AbortSignal) {
    return this.findInPages(id, (offset, abort) => this.reports(offset, abort), signal);
  }
  support(id: string, signal?: AbortSignal) {
    return this.findInPages(id, (offset, abort) => this.supportRequests(offset, abort), signal);
  }
}

/** Explicit RLS write exception for personal notification preferences (supabase/README); no business tables. */
export class SupabasePreferencesRepository {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) {
    this.client = client;
  }
  private async userId() {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw authError(error);
    if (!data.session) throw new ApiError('UNAUTHENTICATED');
    return data.session.user.id;
  }
  async get(): Promise<NotificationPreferences> {
    const id = await this.userId();
    const { data, error } = await this.client
      .from('notification_preferences')
      .select('push_enabled,email_enabled,reminder_24h,reminder_2h')
      .eq('user_id', id)
      .maybeSingle();
    if (error) throw ApiError.fromPostgrest(error);
    return preferencesSchema.parse(
      data ?? { push_enabled: true, email_enabled: true, reminder_24h: true, reminder_2h: true },
    );
  }
  async save(input: NotificationPreferences) {
    const body = preferencesSchema.parse({
      push_enabled: input.pushEnabled,
      email_enabled: input.emailEnabled,
      reminder_24h: input.reminder24h,
      reminder_2h: input.reminder2h,
    });
    const { error } = await this.client.from('notification_preferences').upsert({
      user_id: await this.userId(),
      push_enabled: body.pushEnabled,
      email_enabled: body.emailEnabled,
      reminder_24h: body.reminder24h,
      reminder_2h: body.reminder2h,
    });
    if (error) throw ApiError.fromPostgrest(error);
    return body;
  }
}
