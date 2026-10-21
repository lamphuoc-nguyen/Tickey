import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, unlink, rmdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { RPCS, READ_TABLES } from './import-contract.mjs';
import {
  validateManifest,
  resolveReferences,
  targetFor,
  credentialsFor,
  bootstrapSql,
  applySteps,
  main,
} from './import-platform-data.mjs';

const ownerId = '11111111-1111-4111-8111-111111111111';
const orgId = '22222222-2222-4222-8222-222222222222';
const venueId = '33333333-3333-4333-8333-333333333333';
const token = (claims = {}) =>
  [
    'eyJhbGciOiJIUzI1NiJ9',
    Buffer.from(
      JSON.stringify({ sub: ownerId, role: 'authenticated', exp: 4_000_000_000, ...claims }),
    ).toString('base64url'),
    'test-signature-not-real',
  ].join('.');
const manifest = () => ({
  formatVersion: 1,
  projectRef: 'local',
  actors: { owner: { userId: ownerId, tokenEnv: 'TEST_OWNER_TOKEN' } },
  referenceData: { categories: [], platformMemberships: [], gates: [] },
  steps: [
    {
      id: 'org',
      actor: 'owner',
      kind: 'rpc',
      rpc: 'create_organization',
      args: { p_name: 'Test fixture only', p_slug: 'test-fixture' },
    },
    {
      id: 'venue',
      actor: 'owner',
      kind: 'rpc',
      rpc: 'save_venue',
      args: { p: { tenant_id: { $ref: 'org' }, name: 'Test venue' } },
    },
  ],
});
const state = (data) => ({
  manifestHash: createHash('sha256').update(JSON.stringify(data)).digest('hex'),
  projectRef: data.projectRef,
  steps: {},
});
const env = (url) => ({
  SUPABASE_IMPORT_URL: url,
  SUPABASE_IMPORT_ANON_KEY: 'sb_publishable_test_only',
  TEST_OWNER_TOKEN: token(),
});

test('CLI persists receipts on disk, resumes without duplicate writes and respects state locks', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'tickey-import-test-'));
  const file = join(folder, 'input.json');
  const statePath = `${file}.import-state.json`;
  const lockPath = `${statePath}.lock`;
  try {
    await writeFile(file, JSON.stringify(manifest()));
    await withServer(async (url, requests) => {
      const args = ['apply', '--file', file, '--confirm-project', 'local'];
      await assert.rejects(main(['apply', '--file', file], env(url)), /confirm-project/);
      assert.equal(requests.length, 0);
      await main(args, env(url));
      const receipt = await readFile(statePath, 'utf8');
      assert.equal(JSON.parse(receipt).steps.venue.result, venueId);
      assert.ok(!receipt.includes(token()));
      await assert.rejects(stat(lockPath), { code: 'ENOENT' });
      await main(args, env(url));
      assert.equal(requests.filter((r) => r.method === 'POST').length, 2);
      await writeFile(lockPath, '', { flag: 'wx' });
      const before = requests.length;
      await assert.rejects(main(args, env(url)), /State đang khóa/);
      assert.equal(requests.length, before);
    });
  } finally {
    for (const path of [file, statePath, lockPath]) {
      await unlink(path).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
    await rmdir(folder);
  }
});

// Real fetch/HTTP against an isolated test server; never a hosted Supabase project.
async function withServer(run, handler) {
  const requests = [];
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const request = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: raw ? JSON.parse(raw) : null,
    };
    requests.push(request);
    res.setHeader('Content-Type', 'application/json');
    if (handler && (await handler(request, req, res))) return;
    if (req.url === '/auth/v1/user')
      res.end(
        JSON.stringify({ id: ownerId, email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false }),
      );
    else if (req.url === '/rest/v1/rpc/create_organization') res.end(JSON.stringify(orgId));
    else if (req.url === '/rest/v1/rpc/save_venue') res.end(JSON.stringify(venueId));
    else {
      res.statusCode = 501;
      res.end(JSON.stringify({ message: 'NOT_IMPLEMENTED_IN_TEST' }));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`, requests);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('allowlisted RPC arguments and return types match the checked-in migration', async () => {
  const sql = await readFile(
    new URL('../migrations/20261001000000_init_database.sql', import.meta.url),
    'utf8',
  );
  for (const [name, contract] of Object.entries(RPCS)) {
    const declaration = sql.match(
      new RegExp(`create or replace function public\\.${name}\\(([\\s\\S]*?)\\)\\s*returns (\\w+)`, 'i'),
    );
    assert.ok(declaration, name);
    const args = declaration[1].split(',').map((part) => part.trim());
    assert.deepEqual(
      args.filter((part) => !/ default /i.test(part)).map((part) => part.split(/\s+/)[0]),
      contract.required,
      name,
    );
    assert.deepEqual(
      args.filter((part) => / default /i.test(part)).map((part) => part.split(/\s+/)[0]),
      contract.optional ?? [],
      name,
    );
    assert.equal(
      declaration[2],
      ['json', 'layout'].includes(contract.result) ? 'jsonb' : contract.result,
      name,
    );
  }
  for (const table of READ_TABLES) assert.ok(sql.includes(`create table public.${table} (`), table);
});

test('empty checked-in template is a valid offline plan but cannot apply', async () => {
  const data = JSON.parse(
    await readFile(new URL('../imports/platform-data.example.json', import.meta.url), 'utf8'),
  );
  assert.equal(validateManifest(data), data);
  await assert.rejects(
    applySteps(data, state(data), async () => {}, {}),
    /Chưa có bước/,
  );
  assert.throws(() => bootstrapSql(data), /trống/);
  const output = execFileSync(
    process.execPath,
    [
      'supabase/scripts/import-platform-data.mjs',
      'plan',
      '--file',
      'supabase/imports/platform-data.example.json',
    ],
    { encoding: 'utf8' },
  );
  assert.match(output, /steps: 0/);
  assert.match(output, /không kết nối Supabase/);
});

test('rejects arbitrary writes, server-only jobs, missing arguments and duplicate/forward references', () => {
  for (const rpc of ['apply_payment_success', 'issue_tickets', 'post_ledger_transaction', 'create_booking']) {
    const data = manifest();
    data.steps[0].rpc = rpc;
    assert.throws(() => validateManifest(data), /RPC/);
  }
  for (const change of [
    (d) => delete d.steps[0].id,
    (d) => (d.steps[1].id = 'org'),
    (d) => (d.steps[0].args = { p_name: 'Missing slug' }),
    (d) => (d.steps[0].args.extra = 'not a parameter'),
    (d) => (d.steps[0].args.p_slug = { $ref: 'venue' }),
    (d) => (d.steps[0].kind = 'insert'),
    (d) => (d.actors.owner.token = 'must-not-be-in-manifest'),
    (d) => (d.steps[1].args.p = JSON.parse('{"__proto__":{}}')),
  ]) {
    const data = manifest();
    change(data);
    assert.throws(() => validateManifest(data));
  }
});

test('resolves real result IDs and wildcard arrays without evaluating input', () => {
  assert.deepEqual(
    resolveReferences(
      { ids: { $ref: 'seats', path: ['*', 'id'] } },
      { seats: [{ id: orgId }, { id: venueId }] },
    ),
    { ids: [orgId, venueId] },
  );
  assert.throws(() => resolveReferences({ $ref: 'org', path: ['missing'] }, { org: { id: orgId } }), /path/);
  assert.throws(() => resolveReferences({ $ref: 'missing' }, {}), /reference/);
});

test('enforces target project and rejects privileged keys, expired or mismatched actors', () => {
  const data = manifest();
  data.projectRef = 'ddourrslmudoqevqlvpv';
  assert.equal(targetFor(data, {}), 'https://ddourrslmudoqevqlvpv.supabase.co');
  for (const url of [
    'https://other-project.supabase.co',
    'https://ddourrslmudoqevqlvpv.supabase.co/path',
    'https://user:password@ddourrslmudoqevqlvpv.supabase.co',
  ])
    assert.throws(() => targetFor(data, { SUPABASE_IMPORT_URL: url }));
  for (const change of [
    (e) => delete e.TEST_OWNER_TOKEN,
    (e) => (e.TEST_OWNER_TOKEN = token({ sub: venueId })),
    (e) => (e.TEST_OWNER_TOKEN = token({ exp: 1 })),
    (e) => (e.SUPABASE_IMPORT_ANON_KEY = token({ role: 'service_role' })),
  ]) {
    const values = env();
    change(values);
    assert.throws(() => credentialsFor(data, values));
  }
});

test('bootstrap SQL contains only reviewed reference data and does not interpolate SQL input', () => {
  const data = manifest();
  data.referenceData = {
    categories: [{ slug: 'test', name: "Fixture'); drop schema public cascade; --", sort_order: 1 }],
    platformMemberships: [{ user_id: ownerId, roles: ['SUPPORT'] }],
    gates: [{ tenant_id: orgId, venue_id: venueId, code: 'TEST', name: 'Test gate' }],
  };
  const sql = bootstrapSql(data);
  assert.ok(!sql.includes(data.referenceData.categories[0].name));
  const encoded = sql.match(/decode\('([^']+)', 'base64'\)/)[1];
  assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64').toString()), data.referenceData);
  assert.match(sql, /^--[\s\S]*begin;/);
  assert.match(sql, /auth.users where id=.*email_confirmed_at is not null/);
  assert.match(sql, /tenant_id=\(r->>'tenant_id'\)::uuid/);
  assert.match(sql, /no privilege overwrite/);
  assert.ok(!/disable trigger|set_config|insert into auth\.|delete from|update public\./i.test(sql));
  data.referenceData.platformMemberships[0].roles = ['OWNER'];
  assert.throws(() => bootstrapSql(data), /roles/);
});

test('executes real HTTP with user JWT, resolves IDs and skips succeeded writes on resume', async () => {
  await withServer(async (url, requests) => {
    const data = manifest();
    const journal = state(data);
    const persisted = [];
    const persist = async (value) => persisted.push(structuredClone(value));
    await applySteps(data, journal, persist, env(url), fetch, () => {});
    assert.equal(requests.length, 3);
    assert.equal(requests[0].method, 'GET');
    assert.equal(requests[2].body.p.tenant_id, orgId);
    assert.equal(requests[2].headers.authorization, `Bearer ${token()}`);
    assert.equal(requests[2].headers.apikey, 'sb_publishable_test_only');
    assert.equal(journal.steps.venue.status, 'succeeded');
    assert.equal(persisted[0].steps.org.status, 'started');
    assert.ok(!JSON.stringify(journal).includes(token()));
    await applySteps(data, journal, persist, env(url), fetch, () => {});
    assert.equal(requests.filter((r) => r.method === 'POST').length, 2);
  });
});

test('server MFA rejection is explicit, is never success, and is not retried automatically', async () => {
  await withServer(
    async (url, requests) => {
      const data = manifest();
      const journal = state(data);
      await assert.rejects(
        applySteps(
          data,
          journal,
          async () => {},
          env(url),
          fetch,
          () => {},
        ),
        /MFA_REQUIRED/,
      );
      assert.equal(journal.steps.org.status, 'succeeded');
      assert.equal(journal.steps.venue.status, 'rejected');
      assert.equal(requests.filter((r) => r.url.endsWith('save_venue')).length, 1);
    },
    (r, req, res) => {
      if (!r.url.endsWith('save_venue')) return false;
      res.statusCode = 403;
      res.end(JSON.stringify({ message: 'MFA_REQUIRED', details: null }));
      return true;
    },
  );
});

test('lost response after a write blocks replay, including a restarted import', async () => {
  await withServer(
    async (url, requests) => {
      const data = manifest();
      const journal = state(data);
      await assert.rejects(
        applySteps(
          data,
          journal,
          async () => {},
          env(url),
          fetch,
          () => {},
        ),
        /chưa rõ/,
      );
      assert.equal(journal.steps.org.status, 'uncertain');
      const count = requests.length;
      await assert.rejects(
        applySteps(
          data,
          journal,
          async () => {},
          env(url),
          fetch,
          () => {},
        ),
        /chưa rõ/,
      );
      assert.equal(requests.length, count);
    },
    (r, req) => {
      if (!r.url.endsWith('create_organization')) return false;
      req.socket.destroy();
      return true;
    },
  );
});

test('proxy 5xx or malformed successful response never becomes a successful receipt', async () => {
  for (const scenario of ['proxy', 'invalid-id']) {
    await withServer(
      async (url) => {
        const data = manifest();
        const journal = state(data);
        await assert.rejects(
          applySteps(
            data,
            journal,
            async () => {},
            env(url),
            fetch,
            () => {},
          ),
        );
        assert.equal(journal.steps.org.status, 'uncertain');
      },
      (r, req, res) => {
        if (!r.url.endsWith('create_organization')) return false;
        if (scenario === 'proxy') {
          res.statusCode = 502;
          res.end('<html>Proxy failed</html>');
        } else res.end(JSON.stringify({ id: 'not-a-uuid' }));
        return true;
      },
    );
  }
});

test('wrong user on Auth preflight and changed manifest prevent all writes', async () => {
  await withServer(
    async (url, requests) => {
      const data = manifest();
      const journal = state(data);
      await assert.rejects(
        applySteps(
          data,
          journal,
          async () => {},
          env(url),
          fetch,
          () => {},
        ),
        /actor/,
      );
      assert.equal(requests.filter((r) => r.method === 'POST').length, 0);
      data.steps[0].args.p_slug = 'changed';
      const before = requests.length;
      await assert.rejects(
        applySteps(
          data,
          journal,
          async () => {},
          env(url),
          fetch,
          () => {},
        ),
        /không khớp/,
      );
      assert.equal(requests.length, before);
    },
    (r, req, res) => {
      if (r.url !== '/auth/v1/user') return false;
      res.end(JSON.stringify({ id: venueId, email_confirmed_at: '2026-01-01' }));
      return true;
    },
  );
});

test('select enforces unique records and rejects possibly truncated bulk results', async () => {
  for (const rows of [[], [{ id: orgId }, { id: venueId }]]) {
    await withServer(
      async (url, requests) => {
        const data = manifest();
        data.steps = [
          {
            id: 'find-org',
            actor: 'owner',
            kind: 'select',
            table: 'organizations',
            columns: ['id'],
            filters: { slug: 'real-lookup' },
            expect: 'one',
          },
        ];
        const journal = state(data);
        await assert.rejects(
          applySteps(
            data,
            journal,
            async () => {},
            env(url),
            fetch,
            () => {},
          ),
          /đúng một/,
        );
        assert.equal(journal.steps['find-org'].status, 'rejected');
        assert.equal(requests.at(-1).method, 'GET');
        assert.equal(new URL(requests.at(-1).url, url).searchParams.get('slug'), 'eq.real-lookup');
      },
      (r, req, res) => {
        if (!r.url.startsWith('/rest/v1/organizations?')) return false;
        res.setHeader('Content-Range', rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0');
        res.end(JSON.stringify(rows));
        return true;
      },
    );
  }
  await withServer(
    async (url, requests) => {
      const data = manifest();
      data.steps = [
        {
          id: 'find-orgs',
          actor: 'owner',
          kind: 'select',
          table: 'organizations',
          columns: ['id'],
          filters: { status: 'ACTIVE' },
          expect: 'many',
          limit: 1000,
        },
      ];
      const journal = state(data);
      await assert.rejects(
        applySteps(
          data,
          journal,
          async () => {},
          env(url),
          fetch,
          () => {},
        ),
        /cắt trang/,
      );
      assert.equal(journal.steps['find-orgs'].status, 'rejected');
      assert.equal(requests.at(-1).headers.prefer, 'count=exact');
    },
    (r, req, res) => {
      if (!r.url.startsWith('/rest/v1/organizations?')) return false;
      // A server-side row cap may be smaller than the client's requested limit.
      res.setHeader('Content-Range', '0-0/12');
      res.end(JSON.stringify([{ id: orgId }]));
      return true;
    },
  );
});

test('read steps require exact totals and valid RPC JSON is required for success', async () => {
  await withServer(
    async (url) => {
      const data = manifest();
      data.steps = [
        {
          id: 'find-orgs',
          actor: 'owner',
          kind: 'select',
          table: 'organizations',
          columns: ['id'],
          filters: { slug: 'test-fixture' },
          expect: 'many',
        },
      ];
      await assert.rejects(
        applySteps(
          data,
          state(data),
          async () => {},
          env(url),
          fetch,
          () => {},
        ),
      );
    },
    (r, req, res) => {
      if (!r.url.startsWith('/rest/v1/organizations?')) return false;
      res.end('[]');
      return true;
    },
  );
  await withServer(
    async (url) => {
      const data = manifest();
      data.steps = [
        {
          id: 'member',
          actor: 'owner',
          kind: 'rpc',
          rpc: 'set_org_member',
          args: { p_org_id: orgId, p_email: 'fixture@example.invalid', p_roles: ['SCANNER'] },
        },
      ];
      const journal = state(data);
      await assert.rejects(
        applySteps(
          data,
          journal,
          async () => {},
          env(url),
          fetch,
          () => {},
        ),
        /object hợp lệ/,
      );
      assert.equal(journal.steps.member.status, 'uncertain');
    },
    (r, req, res) => {
      if (!r.url.endsWith('set_org_member')) return false;
      res.end('null');
      return true;
    },
  );
});
