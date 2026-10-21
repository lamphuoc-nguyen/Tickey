import { readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { demoRequest, runDemoStep, parseConfigJson, validateDemo } from './import-demo-data.mjs';
import { readDemoState, protectDemoState } from './demo-state-protection.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const projectRef = 'ddourrslmudoqevqlvpv';
const base = `https://${projectRef}.supabase.co`;
const statePath = join(root, 'supabase/imports/local/platform-demo.import-state.json');
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};
export const cleanLabel = (value) =>
  typeof value === 'string' ? value.replace(/^DEMO\s*[·:\-]\s*/i, '').replace(/\bdemo\b/gi, 'mẫu') : value;
export const cleanSlug = (value) => value.replace(/^tickey-demo-/, '').replace(/^demo-/, '');

export async function main(argv = process.argv.slice(2)) {
  must(
    argv.length === 2 && argv[0] === '--confirm-project' && argv[1] === projectRef,
    'Require exact project confirmation.',
  );
  const data = validateDemo(
    parseConfigJson(await readFile(join(root, 'supabase/imports/platform-demo.dataset.json'), 'utf8')),
  );
  const settings = parseConfigJson(
    await readFile(
      join(process.env.APPDATA, 'Microsoft/UserSecrets/event-platform-api/secrets.json'),
      'utf8',
    ),
  );
  must(settings['Supabase:Url']?.replace(/\/$/, '') === base, 'Wrong backend project.');
  const lock = await open(`${statePath}.lock`, 'wx', 0o600);
  try {
    const journal = readDemoState(await readFile(statePath, 'utf8'));
    must(
      journal.datasetHash === createHash('sha256').update(JSON.stringify(data)).digest('hex') &&
        journal.projectRef === projectRef,
      'Wrong dataset/journal.',
    );
    must(journal.publication?.status === 'PUBLISHED', 'Publish through the server workflow first.');
    must(
      !Object.values(journal.steps).some((row) => ['started', 'uncertain'].includes(row.status)),
      'Reconcile unknown writes first.',
    );
    const persist = async () => {
      const temp = `${statePath}.${process.pid}.tmp`;
      await writeFile(temp, protectDemoState(journal), { mode: 0o600 });
      await rename(temp, statePath);
    };
    const admin = async (path, options) =>
      (await demoRequest(base, path, settings['Supabase:ServiceRoleKey'], options)).value;
    const select = async (table, filters, columns) => {
      const query = new URLSearchParams({ select: columns, limit: '100' });
      for (const [key, value] of Object.entries(filters)) query.set(key, `eq.${value}`);
      const rows = await admin(`/rest/v1/${table}?${query}`);
      must(Array.isArray(rows) && rows.length < 100, 'Invalid or truncated lookup.');
      return rows;
    };
    const one = async (table, id, columns) => {
      const rows = await select(table, { id }, columns);
      must(rows.length === 1, `Missing/duplicate ${table} record.`);
      return rows[0];
    };
    const plan = [];
    const add = async (table, id, expected, patch) => {
      const fields = [...new Set(['id', ...Object.keys(expected), ...Object.keys(patch)])];
      const row = await one(table, id, fields.join(','));
      must(
        Object.entries(expected).every(([key, value]) => row[key] === value || row[key] === patch[key]),
        `Unexpected ${table} source; do not overwrite.`,
      );
      must(
        !Object.hasOwn(patch, 'status') &&
          !Object.hasOwn(patch, 'tenant_id') &&
          !Object.hasOwn(patch, 'layout_version_id'),
        'Only presentation fields may change.',
      );
      if (patch.slug || patch.code) {
        const key = patch.slug ? 'slug' : 'code';
        const filters = { [key]: patch[key], ...(row.venue_id ? { venue_id: row.venue_id } : {}) };
        const conflicts = await select(table, filters, 'id');
        must(
          conflicts.every((other) => other.id === id),
          'New slug/code belongs to another record.',
        );
      }
      plan.push({ table, id, patch });
    };
    const orgIds = {};
    for (const org of data.organizations) {
      const id = journal.steps[`org-${org.key}`].result;
      const row = await one('organizations', id, 'id,name,slug,status,created_by');
      must(
        row.created_by === journal.steps[`auth-${org.actor}`].result.id && row.status === 'APPROVED',
        'Organization ownership/status mismatch.',
      );
      orgIds[org.key] = id;
      await add(
        'organizations',
        id,
        { name: org.name, slug: org.slug },
        { name: cleanLabel(org.name), slug: cleanSlug(org.slug) },
      );
    }
    for (const category of data.categories) {
      const id = journal.steps[`category-${category.slug}`].result.id;
      await add(
        'categories',
        id,
        { name: category.name, slug: category.slug },
        { name: cleanLabel(category.name), slug: cleanSlug(category.slug) },
      );
    }
    for (const venue of data.venues) {
      const id = journal.steps[`venue-${venue.key}`].result;
      const row = await one('venues', id, 'id,tenant_id');
      must(row.tenant_id === orgIds[venue.organization], 'Venue tenant mismatch.');
      await add('venues', id, { name: venue.name }, { name: cleanLabel(venue.name) });
      const layout = journal.steps[`layout-${venue.key}`].result;
      await add(
        'layouts',
        layout.layout_id,
        { name: `DEMO · Sơ đồ ${venue.key}` },
        { name: venue.key === 'hoi-truong' ? 'Sơ đồ hội trường' : 'Sơ đồ không gian mở' },
      );
      for (const gate of venue.gates) {
        const record = journal.steps[`gate-${venue.key}-${gate.code}`].result;
        await add(
          'gates',
          record.id,
          { name: gate.name, code: gate.code, venue_id: id },
          { name: cleanLabel(gate.name), code: gate.code.replace(/^DEMO-/, '') },
        );
      }
    }
    for (const event of data.events) {
      const id = journal.eventIds[event.key];
      const row = await one('events', id, 'id,tenant_id,status,terms');
      must(
        row.tenant_id === orgIds[event.organization] && row.status === 'PUBLISHED',
        'Event tenant/status mismatch.',
      );
      await add(
        'events',
        id,
        { title: event.title, slug: event.slug },
        {
          title: cleanLabel(event.title),
          slug: cleanSlug(event.slug),
          summary: cleanLabel(event.summary),
          description: cleanLabel(event.description),
          terms: cleanLabel(row.terms),
          is_featured: ['dem-nhac', 'hoi-thao'].includes(event.key),
        },
      );
      for (const session of event.sessions) {
        const key = `${event.key}-${session.key}`;
        await add(
          'sessions',
          journal.steps[`session-${key}`].result,
          { title: session.title },
          { title: cleanLabel(session.title) },
        );
        for (const [index, type] of event.ticketTypes.entries())
          await add(
            'ticket_types',
            journal.steps[`type-${key}-${index}`].result,
            { name: type.name },
            { name: cleanLabel(type.name) },
          );
      }
    }
    for (const item of plan) {
      const key = `${item.table}-${item.id}`;
      await runDemoStep(
        journal,
        `presentation-clean-${key}`,
        async () => {
          const query = new URLSearchParams({ id: `eq.${item.id}` });
          const rows = await admin(`/rest/v1/${item.table}?${query}`, { method: 'PATCH', body: item.patch });
          must(
            Array.isArray(rows) &&
              rows.length === 1 &&
              rows[0].id === item.id &&
              Object.entries(item.patch).every(([key, value]) => rows[0][key] === value),
            'Metadata rename response mismatch.',
          );
          return { id: item.id, fields: Object.keys(item.patch) };
        },
        persist,
      );
    }
    // Published zones/seats/layout definitions and historical audit/KYC records are immutable.
    const immutable = [];
    for (const venue of data.venues) {
      const lv = journal.steps[`layout-${venue.key}`].result.layout_version_id;
      const zones = await select('zones', { layout_version_id: lv }, 'id,name');
      immutable.push(
        ...zones
          .filter((zone) => /\bdemo\b/i.test(zone.name))
          .map((zone) => ({ table: 'zones', id: zone.id, reason: 'published immutable data' })),
      );
    }
    journal.presentation = {
      cleanedAt: new Date().toISOString(),
      changedRecords: plan.length,
      remainingImmutableZones: immutable,
      retainedInternalDatasetTag: true,
    };
    await persist();
    const publicQuery = new URLSearchParams({
      select: 'id,title,slug,status',
      id: `in.(${Object.values(journal.eventIds).join(',')})`,
    });
    const publicEvents = (
      await demoRequest(base, `/rest/v1/events?${publicQuery}`, settings['Supabase:AnonKey'])
    ).value;
    must(
      publicEvents.length === 4 &&
        publicEvents.every(
          (event) => event.status === 'PUBLISHED' && !/\bdemo\b/i.test(event.title + event.slug),
        ),
      'Public event labels not clean.',
    );
    console.log(
      JSON.stringify({
        renamedRecords: plan.length,
        publicEvents,
        remainingImmutableZoneLabels: immutable.length,
        credentialsPrinted: false,
      }),
    );
  } finally {
    await lock.close();
    await unlink(`${statePath}.lock`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
