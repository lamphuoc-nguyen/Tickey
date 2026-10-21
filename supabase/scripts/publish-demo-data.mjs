import { readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { demoRequest, runDemoStep, totp, validateDemo, parseConfigJson } from './import-demo-data.mjs';
import { readDemoState, protectDemoState } from './demo-state-protection.mjs';
import { cleanLabel, cleanSlug } from './clean-demo-labels.mjs';

const projectRef = 'ddourrslmudoqevqlvpv';
const base = `https://${projectRef}.supabase.co`;
const datasetTag = 'tickey-demo-v1';
const root = fileURLToPath(new URL('../../', import.meta.url));
const statePath = join(root, 'supabase/imports/local/platform-demo.import-state.json');
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

export function declarationText(org) {
  must(
    org.slug.startsWith('tickey-demo-') && org.name.startsWith('DEMO · '),
    'Only explicitly marked DEMO organizations.',
  );
  return [
    'TICKEY DEMO DATA - NOT LEGAL EVIDENCE',
    `Dataset: ${datasetTag}`,
    `Organization: ${org.name}`,
    `Slug: ${org.slug}`,
    '',
    'This is a synthetic catalog fixture requested by the project operator.',
    'It is NOT a business license, identity document, bank statement, or proof of legal verification.',
    'Document type: OTHER. No real identity number, tax identifier, signature, or seal is provided.',
    'Approval applies only to this clearly marked DEMO dataset so its sample events can be displayed.',
    'Do not use this organization for real selling, payouts, or verification of a real business.',
    '',
  ].join('\n');
}

export function demoReviewNote() {
  return 'DEMO ONLY: synthetic dataset approved for catalog display at the project operator request. Not legal/business/identity verification; not for real selling or payouts.';
}

export async function main(argv = process.argv.slice(2)) {
  must(
    argv.length === 2 && argv[0] === '--confirm-project' && argv[1] === projectRef,
    'Require --confirm-project ddourrslmudoqevqlvpv.',
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
  must(
    data.projectRef === projectRef && settings['Supabase:Url']?.replace(/\/$/, '') === base,
    'Target mismatch.',
  );
  const lock = await open(`${statePath}.lock`, 'wx', 0o600);
  try {
    const journal = readDemoState(await readFile(statePath, 'utf8'));
    must(
      journal.projectRef === projectRef &&
        journal.datasetHash === createHash('sha256').update(JSON.stringify(data)).digest('hex'),
      'Dataset/journal mismatch.',
    );
    must(
      !Object.values(journal.steps).some((step) => ['started', 'uncertain'].includes(step.status)),
      'Unknown write in journal; reconcile before replay.',
    );
    const persist = async () => {
      const temp = `${statePath}.${process.pid}.tmp`;
      await writeFile(temp, protectDemoState(journal), { mode: 0o600 });
      await rename(temp, statePath);
    };
    const step = (id, fn) => runDemoStep(journal, `publish-demo-${id}`, fn, persist);
    const adminKey = settings['Supabase:ServiceRoleKey'];
    const publicKey = settings['Supabase:AnonKey'];
    const admin = async (path) => (await demoRequest(base, path, adminKey)).value;
    const selectOne = async (table, id, columns) => {
      const query = new URLSearchParams({ select: columns, id: `eq.${id}`, limit: '2' });
      const rows = await admin(`/rest/v1/${table}?${query}`);
      must(Array.isArray(rows) && rows.length === 1, `Missing/duplicate ${table} record.`);
      return rows[0];
    };
    const tokens = {};
    const authenticate = async (alias) => {
      if (tokens[alias]) return tokens[alias];
      const credential = journal.credentials[alias];
      const expected = journal.steps[`auth-${alias}`]?.result;
      must(
        credential &&
          expected &&
          credential.email === expected.email &&
          /^tickey-demo-[a-z-]+@example\.com$/.test(credential.email),
        'Only this dataset DEMO account may log in.',
      );
      const login = (
        await demoRequest(base, '/auth/v1/token?grant_type=password', publicKey, {
          method: 'POST',
          body: credential,
        })
      ).value;
      must(
        login?.user?.id === expected.id && login.user.app_metadata?.tickey_demo_dataset === datasetTag,
        'Wrong authenticated DEMO account.',
      );
      let factor = journal.steps[`mfa-${alias}`]?.result;
      if (!factor) {
        factor = await step(`mfa-${alias}`, async () => {
          const result = (
            await demoRequest(base, '/auth/v1/factors', publicKey, {
              method: 'POST',
              token: login.access_token,
              body: { factor_type: 'totp', friendly_name: 'Tickey DEMO publication' },
            })
          ).value;
          must(
            typeof result?.id === 'string' && typeof result.totp?.secret === 'string',
            'Invalid MFA enrollment response.',
          );
          return { id: result.id, secret: result.totp.secret };
        });
      }
      const challenge = await demoRequest(base, `/auth/v1/factors/${factor.id}/challenge`, publicKey, {
        method: 'POST',
        token: login.access_token,
        body: {},
      });
      must(
        challenge.value?.id && challenge.date && Number.isFinite(Date.parse(challenge.date)),
        'Missing MFA challenge/server time.',
      );
      const verified = (
        await demoRequest(base, `/auth/v1/factors/${factor.id}/verify`, publicKey, {
          method: 'POST',
          token: login.access_token,
          body: { challenge_id: challenge.value.id, code: totp(factor.secret, Date.parse(challenge.date)) },
        })
      ).value;
      must(
        verified?.user?.id === expected.id && typeof verified.access_token === 'string',
        'MFA did not verify this DEMO user.',
      );
      tokens[alias] = verified.access_token;
      return tokens[alias];
    };
    const rpc = async (actor, name, args, kind = 'void') => {
      must(
        ['submit_kyc', 'review_kyc', 'submit_event_for_review', 'review_event'].includes(name),
        'RPC outside publication scope.',
      );
      const result = (
        await demoRequest(base, `/rest/v1/rpc/${name}`, publicKey, {
          token: await authenticate(actor),
          method: 'POST',
          body: args,
        })
      ).value;
      must(
        kind === 'void'
          ? result === null
          : kind === 'uuid'
            ? typeof result === 'string' && /^[0-9a-f-]{36}$/.test(result)
            : result && typeof result.status === 'string',
        'Invalid RPC publication response.',
      );
      return result;
    };

    // Preflight every target before any organization/event write.
    const orgRows = {};
    for (const org of data.organizations) {
      const id = journal.steps[`org-${org.key}`]?.result;
      const row = await selectOne('organizations', id, 'id,name,slug,status,created_by');
      must(
        [org.slug, cleanSlug(org.slug)].includes(row.slug) &&
          [org.name, cleanLabel(org.name)].includes(row.name) &&
          row.created_by === journal.steps[`auth-${org.actor}`].result.id &&
          ['DRAFT', 'PENDING_REVIEW', 'APPROVED'].includes(row.status),
        'Organization is not this DEMO fixture or status is incompatible.',
      );
      orgRows[org.key] = row;
    }
    for (const event of data.events) {
      const row = await selectOne('events', journal.eventIds[event.key], 'id,title,slug,tenant_id,status');
      must(
        [event.slug, cleanSlug(event.slug)].includes(row.slug) &&
          [event.title, cleanLabel(event.title)].includes(row.title) &&
          row.tenant_id === orgRows[event.organization].id &&
          ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED'].includes(row.status),
        'Event is not this DEMO fixture or status is incompatible.',
      );
    }

    for (const org of data.organizations) {
      const row = orgRows[org.key];
      if (row.status === 'APPROVED') continue;
      const storagePath = `${row.id}/tickey-demo-declaration.txt`;
      await step(`declaration-${org.key}`, async () => {
        let response;
        try {
          response = await fetch(`${base}/storage/v1/object/kyc-private/${storagePath}`, {
            method: 'POST',
            redirect: 'error',
            signal: AbortSignal.timeout(30_000),
            headers: {
              apikey: publicKey,
              Authorization: `Bearer ${await authenticate(org.actor)}`,
              'Content-Type': 'text/plain; charset=utf-8',
              'x-upsert': 'false',
            },
            body: declarationText(org),
          });
        } catch {
          throw new Error('Storage response unknown; do not retry blindly.');
        }
        if (!response.ok) {
          const error = new Error(`Storage HTTP ${response.status}.`);
          error.uncertain = response.status >= 500;
          throw error;
        }
        await response.text();
        return { storagePath, documentType: 'OTHER' };
      });
      const submissionId = await step(`submit-kyc-${org.key}`, () =>
        rpc(
          org.actor,
          'submit_kyc',
          {
            p_org_id: row.id,
            p_legal_info: {
              legal_name: org.name,
              demo_dataset: datasetTag,
              not_a_real_legal_entity: true,
              notice: demoReviewNote(),
            },
            p_identity_number: `DEMO-NONLEGAL-${org.slug}`,
            p_documents: [{ doc_type: 'OTHER', storage_path: storagePath }],
          },
          'uuid',
        ),
      );
      await step(`review-kyc-${org.key}`, () =>
        rpc('reviewer', 'review_kyc', {
          p_submission_id: submissionId,
          p_decision: 'APPROVED',
          p_note: demoReviewNote(),
        }),
      );
      const approved = await selectOne('organizations', row.id, 'id,status');
      must(approved.status === 'APPROVED', 'Server did not approve the DEMO organization.');
    }
    for (const event of data.events) {
      const eventId = journal.eventIds[event.key];
      const row = await selectOne('events', eventId, 'id,status');
      const actor = data.organizations.find((org) => org.key === event.organization).actor;
      if (row.status === 'DRAFT')
        await step(`submit-event-${event.key}`, () =>
          rpc(actor, 'submit_event_for_review', { p_event_id: eventId }, 'status'),
        );
      const submitted = await selectOne('events', eventId, 'id,status');
      if (submitted.status === 'PENDING_REVIEW')
        await step(`review-event-${event.key}`, () =>
          rpc('reviewer', 'review_event', {
            p_event_id: eventId,
            p_decision: 'APPROVED',
            p_note: demoReviewNote(),
          }),
        );
      const published = await selectOne('events', eventId, 'id,status');
      must(published.status === 'PUBLISHED', 'Server did not publish the DEMO event.');
    }
    const expected = Object.values(journal.eventIds);
    const query = new URLSearchParams({
      select: 'id,title,status',
      id: `in.(${expected.join(',')})`,
      status: 'eq.PUBLISHED',
    });
    const publicEvents = (await demoRequest(base, `/rest/v1/events?${query}`, publicKey)).value;
    must(
      Array.isArray(publicEvents) &&
        expected.every((id) => publicEvents.some((event) => event.id === id && event.status === 'PUBLISHED')),
      'Anonymous Customer cannot read all published DEMO events.',
    );
    journal.publication = {
      status: 'PUBLISHED',
      checkedAt: new Date().toISOString(),
      eventCount: publicEvents.length,
      demoOnly: true,
    };
    await persist();
    console.log(
      JSON.stringify({
        project: projectRef,
        publishedDemoEvents: publicEvents.map((event) => ({
          id: event.id,
          title: event.title,
          status: event.status,
        })),
        anonymousReadVerified: true,
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
