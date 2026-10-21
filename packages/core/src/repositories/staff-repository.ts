import { z } from 'zod';
import type { HttpClient } from '../api/http-client';
import { staffAssignmentSchema } from '../models/staff';

export class HttpStaffRepository {
  private readonly http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }
  assignments(signal?: AbortSignal) {
    return this.http.request('/api/me/staff-assignments', z.array(staffAssignmentSchema), {
      authenticated: true,
      signal,
    });
  }
}
