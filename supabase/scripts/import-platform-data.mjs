#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, open, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RPCS, READ_TABLES, PLATFORM_ROLES, UUID } from './import-contract.mjs';

const own = (value, key) => Object.hasOwn(value, key);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = /^[a-z][a-z0-9_]*$/;
const stepId = /^[a-z][a-z0-9_-]{0,63}$/;
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}
function keys(value, allowed, label) {
  requireThat(object(value), `${label}: cần object.`);
  requireThat(
    Object.keys(value).every((key) => allowed.includes(key)),
    `${label}: có trường không được hỗ trợ.`,
  );
}

function visit(value, callback) {
  if (Array.isArray(value)) return value.forEach((entry) => visit(entry, callback));
  if (!object(value)) return;
  callback(value);
  Object.values(value).forEach((entry) => visit(entry, callback));
}

export function validateManifest(data) {
  keys(data, ['formatVersion', 'projectRef', 'actors', 'referenceData', 'steps'], 'manifest');
  requireThat(data.formatVersion === 1, 'formatVersion phải là 1.');
  requireThat(data.projectRef === 'local' || /^[a-z]{20}$/.test(data.projectRef), 'projectRef không hợp lệ.');
  requireThat(object(data.actors) && Array.isArray(data.steps), 'Cần actors và steps.');
  for (const [name, actor] of Object.entries(data.actors)) {
    requireThat(stepId.test(name), 'Tên actor không hợp lệ.');
    keys(actor, ['userId', 'tokenEnv'], `actor ${name}`);
    requireThat(
      UUID.test(actor.userId) && /^[A-Z][A-Z0-9_]+$/.test(actor.tokenEnv),
      `actor ${name}: cần UUID thật và tên biến tokenEnv.`,
    );
  }
  const seen = new Set();
  for (const step of data.steps) {
    keys(
      step,
      ['id', 'actor', 'kind', 'rpc', 'args', 'table', 'columns', 'filters', 'expect', 'limit'],
      'step',
    );
    requireThat(
      typeof step.id === 'string' && stepId.test(step.id) && !seen.has(step.id),
      'Step id không hợp lệ hoặc bị trùng.',
    );
    requireThat(
      typeof step.actor === 'string' && own(data.actors, step.actor),
      `Step ${step.id}: không tìm thấy actor.`,
    );
    requireThat(['rpc', 'select'].includes(step.kind), `Step ${step.id}: kind phải là rpc/select.`);
    const content = step.kind === 'rpc' ? step.args : step.filters;
    requireThat(object(content), `Step ${step.id}: cần args/filters object.`);
    visit(content, (value) => {
      requireThat(
        !Object.keys(value).some((key) => ['__proto__', 'prototype', 'constructor'].includes(key)),
        'Khóa dữ liệu không hợp lệ.',
      );
      if (own(value, '$ref')) {
        keys(value, ['$ref', 'path'], 'reference');
        requireThat(seen.has(value.$ref), `Step ${step.id}: reference phải trỏ tới step đã khai báo trước.`);
        requireThat(
          value.path === undefined ||
            (Array.isArray(value.path) &&
              value.path.every(
                (part) =>
                  (typeof part === 'string' || Number.isInteger(part)) &&
                  !['__proto__', 'prototype', 'constructor'].includes(part),
              )),
          'Reference path không hợp lệ.',
        );
      }
    });
    if (step.kind === 'rpc') {
      requireThat(own(RPCS, step.rpc), `Step ${step.id}: RPC không nằm trong phạm vi nhập dữ liệu khởi tạo.`);
      const contract = RPCS[step.rpc];
      keys(step.args, [...contract.required, ...(contract.optional ?? [])], `Step ${step.id} args`);
      requireThat(
        contract.required.every((key) => own(step.args, key) && step.args[key] !== null),
        `Step ${step.id}: thiếu tham số bắt buộc.`,
      );
      requireThat(
        !['table', 'columns', 'filters', 'expect', 'limit'].some((key) => own(step, key)),
        `Step ${step.id}: không trộn select và rpc.`,
      );
    } else {
      requireThat(READ_TABLES.has(step.table), `Step ${step.id}: bảng đọc không được hỗ trợ.`);
      requireThat(
        Array.isArray(step.columns) &&
          step.columns.length > 0 &&
          step.columns.every((c) => typeof c === 'string' && identifier.test(c)),
        'Cần columns tường minh, không dùng select *.',
      );
      requireThat(
        Object.keys(step.filters).length > 0 && Object.keys(step.filters).every((c) => identifier.test(c)),
        'Select cần filters eq tường minh.',
      );
      requireThat(['one', 'many'].includes(step.expect), 'Select cần expect one/many.');
      requireThat(
        step.limit === undefined || (Number.isInteger(step.limit) && step.limit > 0 && step.limit <= 1000),
        'limit phải từ 1 đến 1000.',
      );
      requireThat(!own(step, 'rpc') && !own(step, 'args'), 'Không trộn rpc và select.');
    }
    seen.add(step.id);
  }
  validateReferenceData(data.referenceData ?? {});
  return data;
}

export function validateReferenceData(data) {
  keys(data, ['categories', 'platformMemberships', 'gates'], 'referenceData');
  for (const name of ['categories', 'platformMemberships', 'gates'])
    requireThat(data[name] === undefined || Array.isArray(data[name]), `${name} phải là array.`);
  const seen = new Set();
  for (const row of data.categories ?? []) {
    keys(row, ['slug', 'name', 'sort_order'], 'category');
    requireThat(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) && typeof row.name === 'string' && row.name.trim(),
      'Category cần slug/name thật.',
    );
    requireThat(
      row.sort_order === undefined || Number.isInteger(row.sort_order),
      'sort_order phải là số nguyên.',
    );
    requireThat(!seen.has(`category:${row.slug}`), 'Category bị trùng.');
    seen.add(`category:${row.slug}`);
  }
  for (const row of data.platformMemberships ?? []) {
    keys(row, ['user_id', 'roles'], 'platform membership');
    requireThat(
      UUID.test(row.user_id) &&
        Array.isArray(row.roles) &&
        row.roles.length &&
        row.roles.every((r) => PLATFORM_ROLES.includes(r)) &&
        new Set(row.roles).size === row.roles.length,
      'Cần user_id thật và platform roles hợp lệ.',
    );
    requireThat(!seen.has(row.user_id), 'Platform membership bị trùng.');
    seen.add(row.user_id);
  }
  for (const row of data.gates ?? []) {
    keys(row, ['tenant_id', 'venue_id', 'code', 'name'], 'gate');
    requireThat(
      UUID.test(row.tenant_id) &&
        UUID.test(row.venue_id) &&
        typeof row.code === 'string' &&
        row.code.trim() &&
        typeof row.name === 'string' &&
        row.name.trim(),
      'Gate cần org/venue UUID và code/name thật.',
    );
    const key = `gate:${row.venue_id}:${row.code}`;
    requireThat(!seen.has(key), 'Gate bị trùng.');
    seen.add(key);
  }
}

export function resolveReferences(value, results) {
  if (Array.isArray(value)) return value.map((entry) => resolveReferences(entry, results));
  if (!object(value)) return value;
  if (own(value, '$ref')) {
    requireThat(own(results, value.$ref), 'Chưa có kết quả reference.');
    function at(current, parts) {
      if (!parts.length) return current;
      const [key, ...rest] = parts;
      if (key === '*') {
        requireThat(Array.isArray(current), 'Wildcard reference cần array.');
        return current.map((item) => at(item, rest));
      }
      requireThat(
        current !== null && typeof current === 'object' && own(current, key),
        'Không tìm thấy reference path.',
      );
      return at(current[key], rest);
    }
    return at(results[value.$ref], value.path ?? []);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, resolveReferences(item, results)]),
  );
}

export function targetFor(data, environment) {
  const raw =
    environment.SUPABASE_IMPORT_URL ??
    (data.projectRef === 'local' ? 'http://127.0.0.1:54321' : `https://${data.projectRef}.supabase.co`);
  const url = new URL(raw);
  requireThat(
    !url.username && !url.password && !url.search && !url.hash && url.pathname === '/',
    'Supabase URL phải là origin, không chứa credentials/path/query.',
  );
  requireThat(
    data.projectRef === 'local'
      ? ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
          ['http:', 'https:'].includes(url.protocol)
      : url.origin === `https://${data.projectRef}.supabase.co`,
    'URL không khớp projectRef.',
  );
  return url.origin;
}

function claimsOf(token) {
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    if (!object(claims)) throw new Error();
    return claims;
  } catch {
    throw new Error('Access token không hợp lệ.');
  }
}

export function credentialsFor(data, environment) {
  const key = environment.SUPABASE_IMPORT_ANON_KEY;
  requireThat(
    typeof key === 'string' && (key.startsWith('sb_publishable_') || claimsOf(key).role === 'anon'),
    'Cần SUPABASE_IMPORT_ANON_KEY publishable/anon; không dùng service_role/secret key.',
  );
  const tokens = {};
  for (const [alias, actor] of Object.entries(data.actors)) {
    const token = environment[actor.tokenEnv];
    requireThat(typeof token === 'string' && token.length > 0, `Chưa có biến ${actor.tokenEnv}.`);
    const claims = claimsOf(token);
    // This is only a local sanity check; /auth/v1/user below validates the token on the server.
    requireThat(
      claims.role === 'authenticated' &&
        claims.sub === actor.userId &&
        Number(claims.exp) > Date.now() / 1000,
      `Token actor ${alias} sai tài khoản hoặc đã hết hạn.`,
    );
    tokens[alias] = token;
  }
  return { key, tokens };
}

class RemoteError extends Error {
  constructor(message, uncertain = false) {
    super(message);
    this.uncertain = uncertain;
  }
}

export async function requestJson(base, path, key, token, body, fetcher = fetch, exactCount = false) {
  let response;
  try {
    response = await fetcher(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      redirect: 'error',
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(exactCount ? { Prefer: 'count=exact' } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    let result = null;
    try {
      result = text ? JSON.parse(text) : null;
    } catch {
      throw new RemoteError(
        'Response không phải JSON; cần kiểm tra trạng thái thật trước khi thử lại.',
        body !== undefined,
      );
    }
    if (!response.ok) {
      const code = [result?.message, result?.code].find(
        (v) => typeof v === 'string' && /^[A-Z0-9_]{2,64}$/.test(v),
      );
      throw new RemoteError(
        `HTTP ${response.status}${code ? ` (${code})` : ''}.`,
        body !== undefined && response.status >= 500,
      );
    }
    if (exactCount) {
      const total = response.headers.get('content-range')?.match(/\/(\d+)$/)?.[1];
      requireThat(
        total !== undefined && Number.isSafeInteger(Number(total)),
        'Không xác nhận được tổng số record; không dùng kết quả có thể bị cắt trang.',
      );
      return { data: result, count: Number(total) };
    }
    return result;
  } catch (error) {
    if (error instanceof RemoteError) throw error;
    throw new RemoteError('Mất kết nối hoặc timeout; không tự gửi lại thao tác ghi.', body !== undefined);
  }
}

export async function verifyActors(data, base, credentials, fetcher = fetch) {
  for (const [alias, actor] of Object.entries(data.actors)) {
    const user = await requestJson(
      base,
      '/auth/v1/user',
      credentials.key,
      credentials.tokens[alias],
      undefined,
      fetcher,
    );
    requireThat(user?.id === actor.userId, `Supabase không xác nhận được actor ${alias}.`);
    requireThat(
      !!user.email_confirmed_at && !user.is_anonymous,
      `Actor ${alias} cần tài khoản đã xác nhận email.`,
    );
  }
}

export async function applySteps(data, journal, persist, environment, fetcher = fetch, log = console.log) {
  validateManifest(data);
  requireThat(data.steps.length > 0, 'Chưa có bước nhập dữ liệu thật; không chạy manifest trống.');
  const base = targetFor(data, environment);
  const credentials = credentialsFor(data, environment);
  requireThat(
    journal.manifestHash === hash(data) && journal.projectRef === data.projectRef,
    'State không khớp manifest/project. Không dùng lại state của bộ dữ liệu khác.',
  );
  requireThat(object(journal.steps), 'State không hợp lệ.');
  requireThat(
    !Object.values(journal.steps).some((s) => ['started', 'uncertain'].includes(s.status)),
    'Có bước chưa rõ kết quả. Kiểm tra record thật và đối chiếu state trước khi nhập tiếp; không tự replay.',
  );
  await verifyActors(data, base, credentials, fetcher);
  const results = {};
  for (const step of data.steps) {
    const prior = journal.steps[step.id];
    if (prior?.status === 'succeeded') {
      results[step.id] = prior.result;
      log(`${step.id}: đã ghi nhận, bỏ qua.`);
      continue;
    }
    const args = resolveReferences(step.kind === 'rpc' ? step.args : step.filters, results);
    let path;
    if (step.kind === 'rpc') path = `/rest/v1/rpc/${step.rpc}`;
    else {
      const query = new URLSearchParams({
        select: step.columns.join(','),
        limit: String(step.expect === 'one' ? 2 : (step.limit ?? 1000)),
      });
      for (const [column, value] of Object.entries(args)) {
        requireThat(
          ['string', 'number', 'boolean'].includes(typeof value) && !String(value).includes('\0'),
          `Step ${step.id}: filter cần giá trị đơn.`,
        );
        query.set(column, `eq.${value}`);
      }
      path = `/rest/v1/${step.table}?${query}`;
    }
    // Durable intent before the HTTP call: a crash must never silently replay a write.
    journal.steps[step.id] = { status: step.kind === 'rpc' ? 'started' : 'reading' };
    await persist(journal);
    try {
      let result = await requestJson(
        base,
        path,
        credentials.key,
        credentials.tokens[step.actor],
        step.kind === 'rpc' ? args : undefined,
        fetcher,
        step.kind === 'select',
      );
      if (step.kind === 'select') {
        const count = result.count;
        result = result.data;
        requireThat(Array.isArray(result), 'Select response phải là array.');
        if (step.expect === 'one') {
          requireThat(
            result.length === 1 && count === 1,
            `Step ${step.id}: phải tìm được đúng một record, không lấy phần tử đầu khi thiếu/trùng dữ liệu.`,
          );
          result = result[0];
        } else
          requireThat(
            result.length === count,
            `Step ${step.id}: kết quả bị cắt trang; chia nhỏ filters hoặc tăng limit.`,
          );
      } else {
        const kind = RPCS[step.rpc].result;
        requireThat(
          kind !== 'uuid' || (typeof result === 'string' && UUID.test(result)),
          'RPC không trả UUID hợp lệ.',
        );
        requireThat(
          kind !== 'layout' || (UUID.test(result?.layout_id) && UUID.test(result?.layout_version_id)),
          'RPC không trả layout IDs hợp lệ.',
        );
        requireThat(kind !== 'json' || object(result), 'RPC không trả object hợp lệ.');
        requireThat(kind !== 'void' || result === null, 'RPC void trả dữ liệu không đúng contract.');
      }
      journal.steps[step.id] = { status: 'succeeded', result };
      await persist(journal);
      results[step.id] = result;
      log(`${step.id}: hoàn tất.`);
    } catch (error) {
      const uncertain = step.kind === 'rpc' && (!(error instanceof RemoteError) || error.uncertain);
      journal.steps[step.id] = { status: uncertain ? 'uncertain' : 'rejected' };
      await persist(journal);
      throw new Error(
        `Dừng tại ${step.id}: ${error.message}${uncertain ? ' Kết quả chưa rõ; không tự chạy lại.' : ' Các bước trước vẫn được giữ trong state.'}`,
      );
    }
  }
}

export function bootstrapSql(data) {
  validateManifest(data);
  const refs = data.referenceData ?? {};
  requireThat(
    Object.values(refs).some((rows) => rows.length),
    'referenceData trống; không tạo SQL nhập giả.',
  );
  const encoded = Buffer.from(JSON.stringify(refs)).toString('base64');
  return `-- Tickey real reference data. Expected project: ${data.projectRef}
-- Review target Dashboard/connection before execution. No auth users or demo records.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(hashtextextended('tickey-reference-import', 0));
do $tickey_import$
declare
  d jsonb := convert_from(decode('${encoded}', 'base64'), 'UTF8')::jsonb;
  r jsonb;
begin
  for r in select * from jsonb_array_elements(coalesce(d->'categories', '[]')) loop
    insert into public.categories (slug, name, sort_order)
    values (r->>'slug', r->>'name', coalesce((r->>'sort_order')::int, 0)) on conflict (slug) do nothing;
    if not exists (select 1 from public.categories where slug=r->>'slug' and name=r->>'name'
      and sort_order=coalesce((r->>'sort_order')::int, 0)) then
      raise exception 'Category differs from existing data; no overwrite';
    end if;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(d->'platformMemberships', '[]')) loop
    if not exists (select 1 from auth.users where id=(r->>'user_id')::uuid and email_confirmed_at is not null)
      or not exists (select 1 from public.profiles where id=(r->>'user_id')::uuid) then
      raise exception 'Platform member must be an existing confirmed Auth user with profile';
    end if;
    insert into public.memberships (user_id, scope, roles)
    values ((r->>'user_id')::uuid, 'PLATFORM', array(select jsonb_array_elements_text(r->'roles')))
    on conflict (user_id) where scope='PLATFORM' do nothing;
    if not exists (select 1 from public.memberships where user_id=(r->>'user_id')::uuid and scope='PLATFORM'
      and status='ACTIVE' and roles @> array(select jsonb_array_elements_text(r->'roles'))
      and roles <@ array(select jsonb_array_elements_text(r->'roles'))) then
      raise exception 'Existing platform membership differs; no privilege overwrite';
    end if;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(d->'gates', '[]')) loop
    if not exists (select 1 from public.venues where id=(r->>'venue_id')::uuid and tenant_id=(r->>'tenant_id')::uuid) then
      raise exception 'Gate venue must belong to the specified organization';
    end if;
    insert into public.gates (tenant_id, venue_id, code, name)
    values ((r->>'tenant_id')::uuid, (r->>'venue_id')::uuid, r->>'code', r->>'name')
    on conflict (venue_id, code) do nothing;
    if not exists (select 1 from public.gates where venue_id=(r->>'venue_id')::uuid and code=r->>'code'
      and tenant_id=(r->>'tenant_id')::uuid and name=r->>'name' and status='ACTIVE') then
      raise exception 'Gate differs from existing data; no overwrite';
    end if;
  end loop;
end $tickey_import$;
commit;
`;
}

export async function main(argv = process.argv.slice(2), environment = process.env) {
  const [command, ...rest] = argv;
  if (!command || command === '--help') {
    console.log(
      'Usage: node supabase/scripts/import-platform-data.mjs plan|check|apply|bootstrap-sql --file <manifest.json> [--confirm-project <ref>] [--state <file>] [--out <file>]\nDefault plan is offline. check only verifies Auth users. apply writes real RPC data. bootstrap-sql only generates reviewed SQL. See docs/SUPABASE_DATA_IMPORT.md.',
    );
    return;
  }
  requireThat(['plan', 'check', 'apply', 'bootstrap-sql'].includes(command), 'Lệnh không hợp lệ.');
  const flags = {};
  for (let i = 0; i < rest.length; i += 2) {
    requireThat(
      ['--file', '--confirm-project', '--state', '--out'].includes(rest[i]) &&
        rest[i + 1] &&
        !rest[i + 1].startsWith('--') &&
        !own(flags, rest[i]),
      'Tham số CLI không hợp lệ.',
    );
    flags[rest[i]] = rest[i + 1];
  }
  requireThat(flags['--file'], 'Cần --file manifest dữ liệu thật.');
  const data = validateManifest(JSON.parse(await readFile(resolve(flags['--file']), 'utf8')));
  console.log(
    `Project: ${data.projectRef}; actors: ${Object.keys(data.actors).length}; steps: ${data.steps.length}; reference rows: ${Object.values(data.referenceData ?? {}).reduce((n, rows) => n + rows.length, 0)}`,
  );
  if (command === 'plan') {
    data.steps.forEach((s) =>
      console.log(`${s.id}: ${s.actor} → ${s.kind === 'rpc' ? s.rpc : `select ${s.table} (${s.expect})`}`),
    );
    console.log(
      'Chỉ kiểm tra cấu trúc, không kết nối Supabase. Dữ liệu/khóa ngoại/quyền vẫn do server kiểm tra.',
    );
    return;
  }
  if (command === 'bootstrap-sql') {
    requireThat(
      flags['--confirm-project'] === data.projectRef && flags['--out'],
      'Cần --confirm-project đúng ref và --out cho SQL để review.',
    );
    await writeFile(resolve(flags['--out']), bootstrapSql(data), { flag: 'wx', mode: 0o600 });
    console.log('Đã tạo SQL, CHƯA chạy database. File có dữ liệu thật, không commit.');
    return;
  }
  const base = targetFor(data, environment);
  if (command === 'check') {
    requireThat(Object.keys(data.actors).length > 0, 'Chưa khai báo tài khoản thật để kiểm tra.');
    await verifyActors(data, base, credentialsFor(data, environment));
    console.log(
      'Supabase đã xác nhận các tài khoản. Chưa chạy RPC ghi; MFA/quyền nghiệp vụ do từng RPC kiểm tra.',
    );
    return;
  }
  requireThat(
    flags['--confirm-project'] === data.projectRef,
    'apply cần --confirm-project trùng projectRef.',
  );
  requireThat(data.steps.length > 0, 'Không apply manifest trống.');
  if (Object.values(data.referenceData ?? {}).some((rows) => rows.length))
    console.log(
      'referenceData không được nhập bởi apply. Cần xuất, review và chạy SQL riêng bằng data:bootstrap trước bước phụ thuộc.',
    );
  const statePath = resolve(flags['--state'] ?? `${flags['--file']}.import-state.json`);
  await mkdir(dirname(statePath), { recursive: true });
  const lock = await open(`${statePath}.lock`, 'wx', 0o600).catch(() => {
    throw new Error(
      'State đang khóa. Không chạy hai import cùng state; chỉ xóa lock cũ sau khi chắc chắn tiến trình đã dừng.',
    );
  });
  try {
    let journal;
    try {
      journal = JSON.parse(await readFile(statePath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      journal = { manifestHash: hash(data), projectRef: data.projectRef, steps: {} };
    }
    const persist = async (value) => {
      const temp = `${statePath}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
      await rename(temp, statePath);
    };
    await applySteps(data, journal, persist, environment);
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
