import { z } from 'zod';
import { HttpClient, pageQuery } from '../api/http-client';
import {
  availabilitySchema,
  categorySchema,
  eventSchema,
  layoutSchema,
  seatPricingSchema,
  sessionSchema,
  ticketTypeSchema,
} from '../models/catalog';

export class HttpCatalogRepository {
  private readonly http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }
  categories(signal?: AbortSignal) {
    return this.http.request('/api/categories', z.array(categorySchema), { signal });
  }
  events(
    input: { q?: string; categoryId?: string; featured?: boolean; limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ) {
    const query = pageQuery(input);
    if (input.q) query.set('q', input.q);
    if (input.categoryId) query.set('categoryId', input.categoryId);
    if (input.featured) query.set('featured', 'true');
    return this.http.request(`/api/events?${query}`, z.array(eventSchema), { signal });
  }
  event(id: string, signal?: AbortSignal) {
    return this.http.request(`/api/events/${encodeURIComponent(id)}`, eventSchema, { signal });
  }
  sessions(id: string, signal?: AbortSignal) {
    return this.http.request(`/api/events/${encodeURIComponent(id)}/sessions`, z.array(sessionSchema), {
      signal,
    });
  }
  ticketTypes(id: string, signal?: AbortSignal) {
    return this.http.request(
      `/api/sessions/${encodeURIComponent(id)}/ticket-types`,
      z.array(ticketTypeSchema),
      { signal },
    );
  }
  layout(id: string, signal?: AbortSignal) {
    return this.http.request(`/api/sessions/${encodeURIComponent(id)}/layout`, layoutSchema, { signal });
  }
  availability(id: string, signal?: AbortSignal) {
    return this.http.request(`/api/sessions/${encodeURIComponent(id)}/availability`, availabilitySchema, {
      signal,
    });
  }
  seatPricing(id: string, signal?: AbortSignal) {
    return this.http.request(`/api/sessions/${encodeURIComponent(id)}/seat-pricing`, seatPricingSchema, {
      signal,
    });
  }
}
