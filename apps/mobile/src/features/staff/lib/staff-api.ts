import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { z } from 'zod';
import { repositories } from '@/lib/repositories';

const deviceSchema = z.object({
  device_id: z.string(),
  public_keys: z
    .array(z.object({ kid: z.string(), public_key: z.string(), status: z.string().optional() }))
    .default([]),
});

const ticketSchema = z.object({
  id: z.string(),
  zone_id: z.string().nullable().optional(),
  seat_code: z.string().nullable().optional(),
  status: z.string(),
  used_at: z.string().nullable().optional(),
});

export const manifestSchema = z.object({
  server_now: z.string(),
  session: z.object({
    id: z.string(),
    starts_at: z.string(),
    ends_at: z.string().nullable(),
    doors_open_at: z.string().nullable(),
    status: z.string(),
    timezone: z.string().nullable().optional(),
  }),
  gate_zones: z.array(z.object({ gate_id: z.string(), zone_id: z.string() })),
  tickets: z.array(ticketSchema),
  revoked_ticket_ids: z.array(z.string()),
  public_keys: z.array(z.object({ kid: z.string(), public_key: z.string() })),
});
export type StaffManifest = z.infer<typeof manifestSchema>;

export const scanResultSchema = z
  .object({
    result: z.string(),
    replayed: z.boolean().optional(),
    ticket: z
      .object({
        id: z.string(),
        zone_id: z.string().nullable().optional(),
        zone_name: z.string().nullable().optional(),
        seat_code: z.string().nullable().optional(),
        ticket_type: z.string().nullable().optional(),
        holder_name: z.string().nullable().optional(),
      })
      .optional(),
  })
  .passthrough();
export type StaffScanResult = z.infer<typeof scanResultSchema>;

export const attendeeSchema = z.object({
  ticket_id: z.string(),
  status: z.string(),
  booking_code: z.string(),
  name: z.string().nullable(),
  phone_masked: z.string().nullable(),
  zone_name: z.string().nullable(),
  seat_code: z.string().nullable(),
  ticket_type: z.string(),
});
export type StaffAttendee = z.infer<typeof attendeeSchema>;

const analyticsSchema = z.object({
  server_now: z.string(),
  tickets_valid: z.number(),
  checked_in: z.number(),
  by_gate: z.array(z.object({ gate_id: z.string().nullable(), checked_in: z.number() })),
  last_15_min: z.number(),
  rejections: z.record(z.string(), z.number()),
  devices_offline_30m: z.number(),
});
export type StaffAnalytics = z.infer<typeof analyticsSchema>;

const ticketTypeSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  kind: z.string(),
  price_amount: z.number(),
  max_per_order: z.number().optional(),
  status: z.string().optional(),
  visibility: z.string().optional(),
  zones: z.array(z.object({ zone_id: z.string() })).default([]),
  inventory: z.object({ quota: z.number(), locked: z.number(), sold: z.number() }).nullable().optional(),
});
export type StaffTicketType = z.infer<typeof ticketTypeSchema>;

const syncSchema = z.object({
  processed: z.number(),
  duplicate_ticket_ids: z.array(z.string()),
  alerts: z.array(z.unknown()),
  server_now: z.string(),
});

const deviceKey = (orgId: string) => `tickey.staff.device.${orgId}`;

async function fingerprint(orgId: string) {
  const key = deviceKey(orgId);
  const saved = await AsyncStorage.getItem(`${key}.fingerprint`);
  if (saved) return saved;
  const value = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${orgId}:${Crypto.randomUUID()}`,
  );
  await AsyncStorage.setItem(`${key}.fingerprint`, value);
  return value;
}

export async function registerStaffDevice(orgId: string) {
  const key = deviceKey(orgId);
  const savedId = await AsyncStorage.getItem(`${key}.id`);
  const fp = await fingerprint(orgId);
  if (savedId) return { deviceId: savedId, fingerprint: fp };
  const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
  const name = Device.modelName ?? Device.deviceName ?? `Tickey ${platform}`;
  const response = await repositories.http.request('/api/devices', deviceSchema, {
    method: 'POST',
    authenticated: true,
    body: { orgId, fingerprint: fp, name, platform },
  });
  await AsyncStorage.setItem(`${key}.id`, response.device_id);
  await AsyncStorage.setItem(`${key}.name`, name);
  return { deviceId: response.device_id, fingerprint: fp, name, publicKeys: response.public_keys };
}

export async function getStaffManifest(sessionId: string, deviceId: string, since?: string) {
  const query = new URLSearchParams({ deviceId });
  if (since) query.set('since', since);
  return repositories.http.request(
    `/api/sessions/${encodeURIComponent(sessionId)}/manifest?${query}`,
    manifestSchema,
    {
      authenticated: true,
    },
  );
}

export async function checkInStaff(input: {
  ticketId: string;
  sessionId: string;
  gateId: string;
  deviceId: string;
  clientScanId: string;
}) {
  return repositories.http.request('/api/check-in', scanResultSchema, {
    method: 'POST',
    authenticated: true,
    body: {
      ticketId: input.ticketId,
      sessionId: input.sessionId,
      gateId: input.gateId,
      deviceId: input.deviceId,
      clientScanId: input.clientScanId,
    },
  });
}

export async function manualCheckInStaff(input: {
  ticketId: string;
  sessionId: string;
  gateId: string;
  deviceId: string;
}) {
  return repositories.http.request('/api/check-in/manual', scanResultSchema, {
    method: 'POST',
    authenticated: true,
    body: { ...input, idVerified: true },
  });
}

export async function searchStaffAttendees(sessionId: string, query: string) {
  return repositories.http.request(
    `/api/sessions/${encodeURIComponent(sessionId)}/attendees?q=${encodeURIComponent(query)}`,
    z.array(attendeeSchema),
    { authenticated: true },
  );
}

export async function syncStaffScans(input: {
  sessionId: string;
  deviceId: string;
  scans: { clientScanId: string; ticketId: string; gateId: string; scannedAt: string; localResult: string }[];
}) {
  return repositories.http.request('/api/check-in/sync', syncSchema, {
    method: 'POST',
    authenticated: true,
    body: input,
  });
}

export async function getStaffAnalytics(sessionId: string) {
  return repositories.http.request(
    `/api/sessions/${encodeURIComponent(sessionId)}/gate-analytics`,
    analyticsSchema,
    {
      authenticated: true,
    },
  );
}

export async function getStaffTicketTypes(sessionId: string) {
  return repositories.http.request(
    `/api/sessions/${encodeURIComponent(sessionId)}/ticket-types/manage`,
    z.array(ticketTypeSchema),
    { authenticated: true },
  );
}

export async function createStaffPosBooking(input: {
  sessionId: string;
  ticketTypeId: string;
  zoneId?: string;
  quantity: number;
  buyerName?: string;
  buyerPhone?: string;
  buyerEmail?: string;
}) {
  return repositories.http.request(
    '/api/bookings',
    z
      .object({
        id: z.string(),
        code: z.string(),
        status: z.string(),
        booking_type: z.string(),
        total_amount: z.number(),
      })
      .passthrough(),
    {
      method: 'POST',
      authenticated: true,
      body: {
        sessionId: input.sessionId,
        items: [{ ticketTypeId: input.ticketTypeId, zoneId: input.zoneId, quantity: input.quantity }],
        idempotencyKey: Crypto.randomUUID(),
        options: {
          bookingType: 'POS',
          buyerName: input.buyerName ?? null,
          buyerPhone: input.buyerPhone ?? null,
          buyerEmail: input.buyerEmail ?? null,
        },
      },
    },
  );
}

export async function clearStaffDevice(orgId: string) {
  const key = deviceKey(orgId);
  await AsyncStorage.multiRemove([`${key}.id`, `${key}.fingerprint`, `${key}.name`]);
}
