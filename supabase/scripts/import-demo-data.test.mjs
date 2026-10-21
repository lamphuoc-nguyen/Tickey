import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import {
  validateDemo,
  layoutDefinition,
  sessionTimes,
  totp,
  demoRequest,
  runDemoStep,
  importDemo,
  parseConfigJson,
} from './import-demo-data.mjs';
import { protectDemoState, readDemoState } from './demo-state-protection.mjs';

const dataset = JSON.parse(
  await readFile(new URL('../imports/platform-demo.dataset.json', import.meta.url), 'utf8'),
);

test('Windows UTF-8 BOM settings preserve Vietnamese text', () => {
  assert.deepEqual(parseConfigJson('\uFEFF{"name":"Tiếng Việt"}'), { name: 'Tiếng Việt' });
});

test(
  'Windows DPAPI state round-trips without plaintext secrets',
  { skip: process.platform !== 'win32' },
  () => {
    const fixture = {
      credentials: { fixture: { password: 'TEST-FIXTURE-ONLY', name: 'Tiếng Việt' } },
      steps: {},
    };
    const ciphertext = protectDemoState(fixture);
    assert.equal(JSON.parse(ciphertext).protection, 'WindowsCurrentUserDPAPI');
    assert.ok(!ciphertext.includes('TEST-FIXTURE-ONLY'));
    assert.ok(!ciphertext.includes('password'));
    assert.deepEqual(readDemoState(ciphertext), fixture);
  },
);

test('demo dataset has consistent tenants, capacities and explicitly marked content', () => {
  assert.equal(validateDemo(dataset), dataset);
  assert.equal(dataset.organizations.length, 2);
  assert.equal(dataset.events.length, 4);
  assert.equal(
    dataset.events.reduce((n, e) => n + e.sessions.length, 0),
    5,
  );
  for (const change of [
    (d) => (d.events[0].organization = 'ket-noi'),
    (d) => (d.events[0].ticketTypes[0].quota = 10000),
    (d) => (d.events[0].ticketTypes[0].zones = ['MISSING']),
    (d) => (d.events[0].ticketTypes[0].priceAmount = 0),
    (d) => (d.organizations[0].name = 'Real org name'),
    (d) => (d.accounts[0].email = 'real-user@example.org'),
  ]) {
    const value = structuredClone(dataset);
    change(value);
    assert.throws(() => validateDemo(value));
  }
});

test('layout uses unique seat coordinates and preserves independent standing zones', () => {
  const layout = layoutDefinition(dataset.venues[0]);
  assert.equal(layout.zones[0].seats.length, 20);
  assert.equal(layout.zones[1].seats.length, 40);
  assert.equal(layout.zones[2].capacity, 100);
  const seats = layout.zones.flatMap((z) => z.seats ?? []);
  assert.equal(new Set(seats.map((s) => s.id)).size, seats.length);
  assert.equal(new Set(seats.map((s) => `${s.x},${s.y}`)).size, seats.length);
  assert.deepEqual(
    layoutDefinition(dataset.venues[1]).zones.map((z) => z.id),
    ['GA-A', 'GA-B'],
  );
});

test('session times use explicit Vietnam offset and stable base date', () => {
  const times = sessionTimes('2026-10-21', dataset.events[0].sessions[0]);
  assert.equal(times.starts_at, '2026-10-28T12:00:00.000Z');
  assert.equal(times.ends_at, '2026-10-28T14:00:00.000Z');
  assert.ok(Date.parse(times.sales_start_at) < Date.parse(times.sales_end_at));
  assert.throws(() => sessionTimes('invalid', dataset.events[0].sessions[0]));
});

test('TOTP matches RFC 6238 SHA1 vectors without constructing JWTs', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(totp(secret, 59000), '287082');
  assert.equal(totp(secret, 1_111_111_109_000), '081804');
  assert.equal(totp(secret, 2_000_000_000_000), '279037');
});

test('receipts persist intent, skip success and block unknown writes', async () => {
  const journal = { steps: {} };
  const saved = [];
  let requests = 0;
  const persist = async () => saved.push(structuredClone(journal));
  const operation = async () => {
    requests++;
    return 'server-id';
  };
  assert.equal(await runDemoStep(journal, 'create', operation, persist, () => {}), 'server-id');
  assert.equal(saved[0].steps.create.status, 'started');
  await runDemoStep(journal, 'create', operation, persist, () => {});
  assert.equal(requests, 1);
  await assert.rejects(
    runDemoStep(
      journal,
      'lost',
      async () => {
        throw new Error('lost response');
      },
      persist,
      () => {},
    ),
  );
  assert.equal(journal.steps.lost.status, 'uncertain');
  await assert.rejects(runDemoStep(journal, 'lost', operation, persist, () => {}));
  assert.equal(requests, 1);
});

test('real HTTP sends secret only as apikey and reports 401 without response contents', async () => {
  const server = createServer((req, res) => {
    assert.equal(req.headers.apikey, 'sb_secret_test_fixture');
    assert.equal(req.headers.authorization, undefined);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Invalid API key', secret: 'must-never-print' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(
      demoRequest(
        `http://127.0.0.1:${server.address().port}`,
        '/rest/v1/categories',
        'sb_secret_test_fixture',
      ),
      (error) => {
        assert.equal(error.uncertain, false);
        assert.match(error.message, /401/);
        assert.ok(!error.message.includes('must-never-print'));
        return true;
      },
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('invalid admin credentials fail read preflight before account provisioning', async () => {
  const journal = {
    datasetHash: createHash('sha256').update(JSON.stringify(dataset)).digest('hex'),
    projectRef: dataset.projectRef,
    steps: {},
    credentials: {},
    eventIds: {},
  };
  const requests = [];
  await assert.rejects(
    importDemo(
      dataset,
      journal,
      {
        'Supabase:Url': `https://${dataset.projectRef}.supabase.co`,
        'Supabase:AnonKey': 'sb_publishable_fixture',
        'Supabase:ServiceRoleKey': 'sb_secret_fixture',
      },
      async () => {},
      async (url, options) => {
        requests.push({ url, method: options.method });
        return new Response('{}', { status: 401 });
      },
    ),
    /401/,
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'GET');
  assert.deepEqual(journal.steps, {});
});
