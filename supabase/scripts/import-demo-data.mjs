#!/usr/bin/env node
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RPCS, UUID } from './import-contract.mjs';
import { protectDemoState, readDemoState } from './demo-state-protection.mjs';

const DEMO = 'tickey-demo-v1';
export const parseConfigJson = (text) => JSON.parse(text.replace(/^\uFEFF/, ''));
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function validateDemo(data) {
  check(data.formatVersion === 1 && data.datasetKind === 'DEMO', 'Chỉ nhận bộ dữ liệu DEMO phiên bản 1.');
  check(/^[a-z]{20}$/.test(data.projectRef), 'Project ref không hợp lệ.');
  for (const name of ['accounts', 'categories', 'organizations', 'venues', 'events'])
    check(Array.isArray(data[name]) && data[name].length, `Thiếu ${name}.`);
  for (const name of ['accounts', 'organizations', 'venues', 'events'])
    check(new Set(data[name].map((row) => row.key)).size === data[name].length, `Trùng key ${name}.`);
  check(new Set(data.accounts.map((a) => a.email)).size === data.accounts.length, 'Trùng email DEMO.');
  check(
    data.accounts.every(
      (a) => /^tickey-demo-[a-z-]+@example\.com$/.test(a.email) && a.fullName.startsWith('DEMO · '),
    ),
    'Chỉ tạo tài khoản DEMO tại domain ví dụ, không gửi email.',
  );
  const orgs = new Map(data.organizations.map((o) => [o.key, o]));
  const venues = new Map(data.venues.map((v) => [v.key, v]));
  check(
    data.categories.every((c) => c.slug.startsWith('demo-') && c.name.startsWith('DEMO · ')),
    'Category cần nhãn DEMO.',
  );
  for (const org of data.organizations) {
    check(org.name.startsWith('DEMO · ') && org.slug.startsWith('tickey-demo-'), 'Tổ chức cần nhãn DEMO.');
    check(
      data.accounts.some(
        (a) => a.key === org.actor && a.organization === org.key && a.roles.includes('OWNER'),
      ),
      'Owner không khớp tổ chức.',
    );
  }
  for (const account of data.accounts) {
    check(
      account.roles.every((role) => ['OWNER', 'SCANNER', 'POS', 'KYC_REVIEWER'].includes(role)),
      'Role DEMO ngoài phạm vi.',
    );
    check(!account.roles.includes('KYC_REVIEWER') || account.scope === 'PLATFORM', 'Sai scope reviewer.');
    check(!account.organization || orgs.has(account.organization), 'Tài khoản không có tổ chức tương ứng.');
  }
  for (const venue of data.venues) {
    check(
      orgs.has(venue.organization) && venue.name.startsWith('DEMO · '),
      'Venue sai tổ chức hoặc thiếu nhãn.',
    );
    check(new Set(venue.zones.map((z) => z.code)).size === venue.zones.length, 'Trùng code zone.');
    let capacity = 0;
    for (const zone of venue.zones) {
      check(
        zone.name.startsWith('DEMO · ') && ['seated', 'standing'].includes(zone.type),
        'Zone không hợp lệ.',
      );
      const size = zone.type === 'seated' ? zone.rows.length * zone.seatsPerRow : zone.capacity;
      check(Number.isInteger(size) && size > 0, 'Sức chứa zone không hợp lệ.');
      capacity += size;
    }
    check(capacity <= venue.capacity, 'Layout vượt sức chứa venue.');
    for (const gate of venue.gates)
      check(
        gate.code.startsWith('DEMO-') &&
          gate.name.startsWith('DEMO · ') &&
          gate.zones.every((code) => venue.zones.some((z) => z.code === code)),
        'Cổng sai mapping.',
      );
  }
  for (const event of data.events) {
    const venue = venues.get(event.venue);
    check(venue?.organization === event.organization, 'Event và venue khác tenant.');
    check(
      event.title.startsWith('DEMO · ') && event.slug.startsWith('tickey-demo-'),
      'Sự kiện cần nhãn DEMO.',
    );
    check(
      data.categories.some((c) => c.slug === event.category),
      'Sai category.',
    );
    check(event.sessions.length > 0 && event.ticketTypes.length > 0, 'Thiếu suất/hạng vé.');
    for (const session of event.sessions)
      check(
        Number.isInteger(session.daysAfterBase) &&
          session.daysAfterBase > 0 &&
          session.startHour >= 1 &&
          session.startHour + session.durationHours < 24,
        'Thời gian suất không hợp lệ.',
      );
    const totals = new Map();
    for (const type of event.ticketTypes) {
      check(
        type.name.startsWith('DEMO · ') && ['FREE', 'PAID'].includes(type.kind),
        'Hạng vé DEMO không hợp lệ.',
      );
      check(
        Number.isSafeInteger(type.priceAmount) &&
          (type.kind === 'FREE' ? type.priceAmount === 0 : type.priceAmount > 0),
        'Giá không hợp lệ.',
      );
      check(
        Number.isInteger(type.quota) && type.quota > 0 && type.zones.length === 1,
        'Quota/mapping không hợp lệ.',
      );
      const zone = venue.zones.find((z) => z.code === type.zones[0]);
      check(zone, 'Hạng vé thiếu zone.');
      totals.set(zone.code, (totals.get(zone.code) ?? 0) + type.quota);
      const capacity = zone.type === 'seated' ? zone.rows.length * zone.seatsPerRow : zone.capacity;
      check(totals.get(zone.code) <= capacity, 'Quota vượt sức chứa zone.');
    }
  }
  return data;
}

export function layoutDefinition(venue) {
  return {
    zones: venue.zones.map((zone, index) =>
      zone.type === 'standing'
        ? { id: zone.code, name: zone.name, type: zone.type, color: zone.color, capacity: zone.capacity }
        : {
            id: zone.code,
            name: zone.name,
            type: zone.type,
            color: zone.color,
            seats: zone.rows.flatMap((row, r) =>
              Array.from({ length: zone.seatsPerRow }, (_, n) => ({
                id: `${zone.code}-${row}-${n + 1}`,
                section: zone.name,
                row,
                number: String(n + 1),
                x: (n + 1) * 32,
                y: (index * 6 + r + 1) * 32,
                flags: [],
              })),
            ),
          },
    ),
  };
}

export function sessionTimes(baseDate, session) {
  const base = Date.parse(`${baseDate}T00:00:00+07:00`);
  check(Number.isFinite(base) && /^\d{4}-\d{2}-\d{2}$/.test(baseDate), 'Ngày gốc không hợp lệ.');
  const starts = base + session.daysAfterBase * 86_400_000 + session.startHour * 3_600_000;
  return {
    starts_at: new Date(starts).toISOString(),
    ends_at: new Date(starts + session.durationHours * 3_600_000).toISOString(),
    doors_open_at: new Date(starts - 3_600_000).toISOString(),
    sales_start_at: new Date(base - 86_400_000).toISOString(),
    sales_end_at: new Date(starts - 3_600_000).toISOString(),
  };
}

// RFC 6238 TOTP for newly created DEMO accounts only. No JWT claims are forged.
export function totp(secret, now = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of secret.toUpperCase().replace(/=+$/, '')) {
    check(alphabet.includes(character), 'TOTP secret không hợp lệ.');
    bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  }
  const bytes = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const hash = createHmac('sha1', bytes).update(counter).digest();
  const offset = hash.at(-1) & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

export async function demoRequest(base, path, key, { token, method = 'GET', body } = {}, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(`${base}${path}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: {
        apikey: key,
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : !key.startsWith('sb_')
            ? { Authorization: `Bearer ${key}` }
            : {}),
        'Content-Type': 'application/json',
        Prefer: 'return=representation,count=exact',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const raw = await response.text();
    let value;
    try {
      value = raw ? JSON.parse(raw) : null;
    } catch {
      const error = new Error('Response không hợp lệ; cần đối chiếu kết quả thật.');
      error.uncertain = true;
      throw error;
    }
    if (!response.ok) {
      const code = [value?.message, value?.code, value?.error_code].find(
        (v) => typeof v === 'string' && /^[a-zA-Z0-9_]{2,64}$/.test(v),
      );
      const error = new Error(`Supabase HTTP ${response.status}${code ? ` (${code})` : ''}.`);
      error.uncertain = response.status >= 500;
      throw error;
    }
    return { value, date: response.headers.get('date') };
  } catch (error) {
    if (error.uncertain !== undefined) throw error;
    const failure = new Error('Không nhận được kết quả; dừng và không tự retry.');
    failure.uncertain = true;
    throw failure;
  }
}

export async function runDemoStep(journal, id, operation, persist, log = console.log) {
  const previous = journal.steps[id];
  if (previous?.status === 'succeeded') return previous.result;
  check(!previous || previous.status === 'rejected', 'Có thao tác chưa rõ kết quả; không tự replay.');
  journal.steps[id] = { status: 'started' };
  await persist();
  try {
    const result = await operation();
    journal.steps[id] = { status: 'succeeded', result };
    await persist();
    log(`${id}: hoàn tất.`);
    return result;
  } catch (error) {
    journal.steps[id] = { status: error.uncertain === false ? 'rejected' : 'uncertain' };
    await persist();
    throw new Error(`Dừng tại ${id}: ${error.message}`);
  }
}

export async function importDemo(data, journal, settings, persist, fetcher = fetch) {
  validateDemo(data);
  check(
    journal.datasetHash === digest(data) && journal.projectRef === data.projectRef,
    'Journal khác bộ dữ liệu/project.',
  );
  check(
    !Object.values(journal.steps).some((step) => ['started', 'uncertain'].includes(step.status)),
    'Journal có kết quả chưa rõ; cần kiểm tra record thật, không tự chạy lại.',
  );
  const base = `https://${data.projectRef}.supabase.co`;
  check(
    settings['Supabase:Url']?.replace(/\/$/, '') === base,
    'Cấu hình backend khác project được xác nhận.',
  );
  const secret = settings['Supabase:ServiceRoleKey'];
  const publicKey = settings['Supabase:AnonKey'];
  check(
    typeof secret === 'string' && secret.length && typeof publicKey === 'string' && publicKey.length,
    'Thiếu cấu hình backend.',
  );
  const admin = async (path, options) => (await demoRequest(base, path, secret, options, fetcher)).value;
  // Must pass before the first mutation; 401 never becomes an empty dataset.
  const existingUsers = await admin('/auth/v1/admin/users?page=1&per_page=1');
  check(Array.isArray(existingUsers?.users), 'Không xác nhận được quyền Auth admin.');
  const step = (id, fn) => runDemoStep(journal, id, fn, persist);
  const users = {};
  for (const account of data.accounts) {
    journal.credentials[account.key] ??= {
      email: account.email,
      password: `Tk!${randomBytes(24).toString('base64url')}9a`,
    };
    await persist();
    users[account.key] = await step(`auth-${account.key}`, async () => {
      const user = await admin('/auth/v1/admin/users', {
        method: 'POST',
        body: {
          email: account.email,
          password: journal.credentials[account.key].password,
          email_confirm: true,
          user_metadata: { full_name: account.fullName },
          app_metadata: { tickey_demo_dataset: DEMO },
        },
      });
      check(
        UUID.test(user?.id) &&
          user.email === account.email &&
          user.app_metadata?.tickey_demo_dataset === DEMO,
        'Auth không trả user DEMO đúng contract.',
      );
      return { id: user.id, email: user.email };
    });
  }
  const tokens = {};
  for (const org of data.organizations) {
    const account = journal.credentials[org.actor];
    const response = await demoRequest(
      base,
      '/auth/v1/token?grant_type=password',
      publicKey,
      {
        method: 'POST',
        body: { email: account.email, password: account.password },
      },
      fetcher,
    );
    const login = response.value;
    check(
      login?.user?.id === users[org.actor].id && typeof login.access_token === 'string',
      'Đăng nhập DEMO không hợp lệ.',
    );
    const factor = await step(`mfa-${org.actor}`, async () => {
      const enrolled = (
        await demoRequest(
          base,
          '/auth/v1/factors',
          publicKey,
          { token: login.access_token, method: 'POST', body: { factor_type: 'totp', friendly_name: DEMO } },
          fetcher,
        )
      ).value;
      check(
        UUID.test(enrolled?.id) && typeof enrolled?.totp?.secret === 'string',
        'MFA enroll không đúng contract.',
      );
      return { id: enrolled.id, secret: enrolled.totp.secret };
    });
    const challenge = await demoRequest(
      base,
      `/auth/v1/factors/${factor.id}/challenge`,
      publicKey,
      { token: login.access_token, method: 'POST', body: {} },
      fetcher,
    );
    check(
      UUID.test(challenge.value?.id) && challenge.date && Number.isFinite(Date.parse(challenge.date)),
      'Không lấy được challenge/thời gian server.',
    );
    const verified = (
      await demoRequest(
        base,
        `/auth/v1/factors/${factor.id}/verify`,
        publicKey,
        {
          token: login.access_token,
          method: 'POST',
          body: { challenge_id: challenge.value.id, code: totp(factor.secret, Date.parse(challenge.date)) },
        },
        fetcher,
      )
    ).value;
    check(
      verified?.user?.id === users[org.actor].id && typeof verified?.access_token === 'string',
      'Không xác minh được MFA DEMO.',
    );
    tokens[org.actor] = verified.access_token;
  }
  const rpc = async (actor, name, args) => {
    check(Object.hasOwn(RPCS, name), 'RPC ngoài phạm vi.');
    check(
      RPCS[name].required.every((key) => Object.hasOwn(args, key)),
      'RPC thiếu tham số.',
    );
    const value = (
      await demoRequest(
        base,
        `/rest/v1/rpc/${name}`,
        publicKey,
        { token: tokens[actor], method: 'POST', body: args },
        fetcher,
      )
    ).value;
    const kind = RPCS[name].result;
    check(kind !== 'uuid' || UUID.test(value), 'RPC trả UUID không hợp lệ.');
    check(
      kind !== 'layout' || (UUID.test(value?.layout_id) && UUID.test(value?.layout_version_id)),
      'RPC trả layout không hợp lệ.',
    );
    check(kind !== 'void' || value === null, 'RPC void trả dữ liệu không hợp lệ.');
    check(
      kind !== 'json' || (value !== null && typeof value === 'object' && !Array.isArray(value)),
      'RPC JSON không hợp lệ.',
    );
    return value;
  };
  const selectOne = async (table, filters, columns = 'id') => {
    const query = new URLSearchParams({ select: columns, limit: '2' });
    for (const [key, value] of Object.entries(filters)) query.set(key, `eq.${value}`);
    const rows = await admin(`/rest/v1/${table}?${query}`);
    check(Array.isArray(rows) && rows.length <= 1, 'Lookup DEMO trùng record.');
    return rows[0] ?? null;
  };
  const insertReference = async (table, row, filters, columns) => {
    check(['categories', 'memberships', 'gates'].includes(table), 'Không ghi trực tiếp bảng nghiệp vụ.');
    const existing = await selectOne(table, filters, columns);
    if (existing) {
      check(
        Object.entries(row).every(([key, value]) => JSON.stringify(existing[key]) === JSON.stringify(value)),
        'Dữ liệu DEMO đã có nhưng khác; không ghi đè.',
      );
      return existing;
    }
    const rows = await admin(`/rest/v1/${table}`, { method: 'POST', body: row });
    check(
      Array.isArray(rows) && rows.length === 1 && UUID.test(rows[0].id),
      'Không nhận được reference record hợp lệ.',
    );
    return rows[0];
  };
  for (const account of data.accounts.filter((a) => a.scope === 'PLATFORM'))
    await step(`platform-${account.key}`, () =>
      insertReference(
        'memberships',
        { user_id: users[account.key].id, scope: 'PLATFORM', roles: account.roles },
        { user_id: users[account.key].id, scope: 'PLATFORM' },
        'id,user_id,scope,roles',
      ),
    );
  const categories = {};
  for (const row of data.categories)
    categories[row.slug] = await step(`category-${row.slug}`, () =>
      insertReference('categories', row, { slug: row.slug }, 'id,slug,name,sort_order'),
    );
  const orgs = {};
  for (const org of data.organizations) {
    orgs[org.key] = await step(`org-${org.key}`, () =>
      rpc(org.actor, 'create_organization', {
        p_name: org.name,
        p_slug: org.slug,
        p_business_type: org.businessType,
      }),
    );
    for (const account of data.accounts.filter(
      (a) => a.organization === org.key && !a.roles.includes('OWNER'),
    ))
      await step(`member-${account.key}`, () =>
        rpc(org.actor, 'set_org_member', {
          p_org_id: orgs[org.key],
          p_email: account.email,
          p_roles: account.roles,
        }),
      );
  }
  const venues = {};
  const layouts = {};
  const zones = {};
  const gates = {};
  for (const venue of data.venues) {
    const actor = data.organizations.find((o) => o.key === venue.organization).actor;
    venues[venue.key] = await step(`venue-${venue.key}`, () =>
      rpc(actor, 'save_venue', {
        p: {
          tenant_id: orgs[venue.organization],
          name: venue.name,
          venue_type: venue.venueType,
          address_line: venue.address,
          city: venue.city,
          timezone: venue.timezone,
          capacity: venue.capacity,
        },
      }),
    );
    layouts[venue.key] = await step(`layout-${venue.key}`, () =>
      rpc(actor, 'create_layout', { p_venue_id: venues[venue.key], p_name: `DEMO · Sơ đồ ${venue.key}` }),
    );
    await step(`draft-${venue.key}`, () =>
      rpc(actor, 'save_layout_draft', {
        p_layout_version_id: layouts[venue.key].layout_version_id,
        p_definition: layoutDefinition(venue),
      }),
    );
    await step(`publish-layout-${venue.key}`, () =>
      rpc(actor, 'publish_layout_version', { p_layout_version_id: layouts[venue.key].layout_version_id }),
    );
    for (const zone of venue.zones) {
      zones[`${venue.key}:${zone.code}`] = await selectOne('zones', {
        layout_version_id: layouts[venue.key].layout_version_id,
        code: zone.code,
      });
      check(UUID.test(zones[`${venue.key}:${zone.code}`]?.id), 'Không có zone sau publish.');
    }
    for (const gate of venue.gates)
      gates[`${venue.key}:${gate.code}`] = await step(`gate-${venue.key}-${gate.code}`, () =>
        insertReference(
          'gates',
          {
            tenant_id: orgs[venue.organization],
            venue_id: venues[venue.key],
            code: gate.code,
            name: gate.name,
          },
          { venue_id: venues[venue.key], code: gate.code },
          'id,tenant_id,venue_id,code,name',
        ),
      );
  }
  const events = {};
  const sessions = {};
  let typeCount = 0;
  for (const event of data.events) {
    const org = data.organizations.find((o) => o.key === event.organization);
    const venue = data.venues.find((v) => v.key === event.venue);
    events[event.key] = await step(`event-${event.key}`, () =>
      rpc(org.actor, 'save_event', {
        p: {
          tenant_id: orgs[event.organization],
          title: event.title,
          slug: event.slug,
          summary: event.summary,
          description: event.description,
          category_id: categories[event.category].id,
          age_limit: event.ageLimit,
          terms: 'DEMO: dữ liệu giả, không dùng để tham dự hoặc thanh toán thật.',
        },
      }),
    );
    for (const session of event.sessions) {
      const sessionKey = `${event.key}-${session.key}`;
      sessions[sessionKey] = await step(`session-${sessionKey}`, () =>
        rpc(org.actor, 'save_session', {
          p: {
            event_id: events[event.key],
            venue_id: venues[event.venue],
            layout_version_id: layouts[event.venue].layout_version_id,
            title: session.title,
            ...sessionTimes(journal.baseDate, session),
            max_tickets_per_account: 6,
          },
        }),
      );
      for (const [i, type] of event.ticketTypes.entries()) {
        await step(`type-${sessionKey}-${i}`, () =>
          rpc(org.actor, 'save_ticket_type', {
            p: {
              session_id: sessions[sessionKey],
              name: type.name,
              kind: type.kind,
              price_amount: type.priceAmount,
              quota: type.quota,
              max_per_order: type.maxPerOrder,
              zone_ids: type.zones.map((code) => zones[`${event.venue}:${code}`].id),
              sort_order: i + 1,
            },
          }),
        );
        typeCount++;
      }
      await step(`gate-zones-${sessionKey}`, () =>
        rpc(org.actor, 'set_session_gate_zones', {
          p_session_id: sessions[sessionKey],
          p_config: venue.gates.map((gate) => ({
            gate_id: gates[`${venue.key}:${gate.code}`].id,
            zone_ids: gate.zones.map((code) => zones[`${venue.key}:${code}`].id),
          })),
        }),
      );
      for (const account of data.accounts.filter(
        (a) => a.organization === event.organization && a.roles.includes('SCANNER'),
      ))
        await step(`assignment-${sessionKey}-${account.key}`, () =>
          rpc(org.actor, 'assign_staff', {
            p_session_id: sessions[sessionKey],
            p_user_id: users[account.key].id,
            p_permissions: ['SCAN', 'MANUAL_CHECKIN', ...(account.roles.includes('POS') ? ['POS'] : [])],
            p_gate_id: gates[`${venue.key}:${venue.gates[0].code}`].id,
          }),
        );
    }
  }
  // Deliberately no KYC fabrications, event status writes, bookings or money operations.
  const counts = {
    accounts: data.accounts.length,
    categories: data.categories.length,
    organizations: Object.keys(orgs).length,
    venues: Object.keys(venues).length,
    layouts: Object.keys(layouts).length,
    zones: Object.keys(zones).length,
    gates: Object.keys(gates).length,
    events: Object.keys(events).length,
    sessions: Object.keys(sessions).length,
    ticketTypes: typeCount,
  };
  const expectedStatus = journal.publication?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
  for (const [key, id] of Object.entries(events)) {
    const row = await selectOne('events', { id }, 'id,slug,status');
    check(
      row?.status === expectedStatus,
      'Trạng thái sự kiện khác nhật ký; kiểm tra thủ công trước khi tiếp tục.',
    );
    journal.eventIds[key] = id;
  }
  journal.counts = counts;
  journal.finishedAt = new Date().toISOString();
  await persist();
  console.log(
    JSON.stringify({
      project: data.projectRef,
      counts,
      eventStatus: expectedStatus,
      note: 'Đã đối chiếu dữ liệu mẫu với trạng thái server và nhật ký. Không tạo giao dịch/vé giả; credentials chỉ nằm trong journal mã hóa.',
    }),
  );
}

export async function main(argv = process.argv.slice(2), environment = process.env) {
  if (argv[0] === '--protect-state') {
    check(
      argv.length === 2,
      'Dùng --protect-state <journal path>. Chỉ mã hóa file local, không gọi Supabase.',
    );
    const path = resolve(argv[1]);
    const lock = await open(`${path}.lock`, 'wx', 0o600);
    try {
      const journal = readDemoState(await readFile(path, 'utf8'));
      const temp = `${path}.${process.pid}.tmp`;
      await writeFile(temp, protectDemoState(journal), { mode: 0o600 });
      await rename(temp, path);
      console.log('Đã bảo vệ nhật ký DEMO bằng Windows DPAPI. Không xuất credential, không gọi mạng.');
    } finally {
      await lock.close();
      await unlink(`${path}.lock`);
    }
    return;
  }
  const flags = {};
  for (let i = 0; i < argv.length; i += 2) {
    check(
      ['--file', '--confirm-project', '--state', '--base-date'].includes(argv[i]) &&
        argv[i + 1] &&
        !flags[argv[i]],
      'Dùng --file <dataset> --confirm-project <ref> [--state <file>] [--base-date YYYY-MM-DD].',
    );
    flags[argv[i]] = argv[i + 1];
  }
  const file = resolve(flags['--file'] ?? 'supabase/imports/platform-demo.dataset.json');
  const data = validateDemo(parseConfigJson(await readFile(file, 'utf8')));
  check(
    flags['--confirm-project'] === data.projectRef,
    'Cần --confirm-project khớp projectRef để ghi dữ liệu DEMO thật.',
  );
  check(environment.APPDATA, 'Không tìm thấy APPDATA để đọc cấu hình backend đã được người dùng thiết lập.');
  const settings = parseConfigJson(
    await readFile(
      join(environment.APPDATA, 'Microsoft', 'UserSecrets', 'event-platform-api', 'secrets.json'),
      'utf8',
    ),
  );
  const statePath = resolve(flags['--state'] ?? 'supabase/imports/local/platform-demo.import-state.json');
  await mkdir(dirname(statePath), { recursive: true });
  const lock = await open(`${statePath}.lock`, 'wx', 0o600).catch(() => {
    throw new Error('Demo import đang khóa; không chạy trùng hoặc xóa lock khi tiến trình còn chạy.');
  });
  try {
    let journal;
    try {
      journal = readDemoState(await readFile(statePath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      journal = {
        datasetHash: digest(data),
        projectRef: data.projectRef,
        baseDate: flags['--base-date'] ?? today,
        steps: {},
        credentials: {},
        eventIds: {},
      };
    }
    check(
      !flags['--base-date'] || journal.baseDate === flags['--base-date'],
      'Không đổi ngày gốc của đợt nhập đang có.',
    );
    sessionTimes(journal.baseDate, data.events[0].sessions[0]);
    const persist = async () => {
      const temp = `${statePath}.${process.pid}.tmp`;
      await writeFile(temp, protectDemoState(journal), { mode: 0o600 });
      await rename(temp, statePath);
    };
    await persist();
    await importDemo(data, journal, settings, persist);
    console.log(`Credentials/nhật ký riêng: ${statePath}. Không commit hoặc chia sẻ công khai.`);
  } finally {
    await lock.close();
    await unlink(`${statePath}.lock`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => {
    console.error(error instanceof SyntaxError ? 'JSON không hợp lệ.' : error.message);
    process.exitCode = 1;
  });
