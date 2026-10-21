#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { demoRequest, parseConfigJson } from './import-demo-data.mjs';
import { readDemoState } from './demo-state-protection.mjs';
import { cleanLabel, cleanSlug } from './clean-demo-labels.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const project = 'ddourrslmudoqevqlvpv';
const base = `https://${project}.supabase.co`;
const api = 'http://127.0.0.1:5080';
const must = (value, message) => { if (!value) throw new Error(message); };
const hasImage = (row) => typeof row?.cover_image_url === 'string' && row.cover_image_url.trim().length > 0;

export function parseOptions(argv) {
  const mode = argv[0] ?? 'plan';
  must(['plan', 'apply'].includes(mode), 'Use plan or apply.');
  const flags = {};
  for (let index = 1; index < argv.length; index += 2) {
    const name = argv[index];
    must(['--confirm-project', '--api-url'].includes(name) && argv[index + 1] && !flags[name], 'Invalid or duplicate command option.');
    flags[name] = argv[index + 1];
  }
  must(mode !== 'apply' || flags['--confirm-project'] === project, `Require --confirm-project ${project}.`);
  const url = new URL(flags['--api-url'] ?? api);
  must(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, 'The maintenance API must use a local http://127.0.0.1:<port> or http://localhost:<port> address.');
  return { apply: mode === 'apply', apiBase: url.origin };
}

export function validateUpload(value, orgId, cloudName) {
  must(value?.bucket === 'event-assets', 'Upload did not return an event asset.');
  must(new RegExp(`^${orgId}/cloudinary/[a-f0-9]{32}\\.png$`).test(value.path ?? ''), 'Upload did not use the Cloudinary provider or correct organization.');
  let url;
  try { url = new URL(value.public_url); } catch { throw new Error('Missing valid uploaded URL.'); }
  must(url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && !url.username && !url.password && !url.port && url.pathname.startsWith(`/${cloudName}/image/upload/`), 'Unexpected Cloudinary delivery URL.');
  return value;
}

/** Preserve existing images; persist upload intent before sending to prevent duplicate uploads on unknown outcomes. */
export async function fillMissingCover({ read, upload, save, receipt, persist }) {
  let row = await read();
  if (hasImage(row)) return { status: 'preserved', url: row.cover_image_url };
  must(row && ['DRAFT', 'CHANGES_REQUESTED', 'PUBLISHED'].includes(row.status), 'Event cannot currently be edited.');
  if (!receipt.upload) {
    must(!receipt.uploadStarted, 'Previous upload outcome is unknown. Reconcile its Cloudinary asset before retrying.');
    receipt.uploadStarted = true;
    await persist();
    try {
      receipt.upload = await upload();
    } catch (error) {
      // Only reset intent when the transport proves no upload request could reach the API.
      // Timeouts, dropped responses and HTTP errors remain uncertain and are never replayed blindly.
      if (error.beforeUpload === true) {
        receipt.uploadStarted = false;
        await persist();
      }
      throw error;
    }
    await persist();
  }
  row = await read();
  if (hasImage(row)) return { status: 'preserved', url: row.cover_image_url };
  await save(receipt.upload.public_url);
  row = await read();
  must(row.cover_image_url === receipt.upload.public_url, 'Server did not confirm the saved image.');
  receipt.saved = true;
  await persist();
  return { status: 'saved', url: row.cover_image_url };
}

function connectionRefused(error) {
  const cause = error?.cause ?? error;
  return Array.isArray(cause?.errors)
    ? cause.errors.length > 0 && cause.errors.every(connectionRefused)
    : cause?.code === 'ECONNREFUSED';
}

export async function jsonRequest(url, options = {}, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(90_000) });
  } catch (error) {
    const refused = connectionRefused(error);
    const failure = new Error(refused
      ? `Cannot connect to the local backend at ${new URL(url).origin}. Start the API in a separate terminal and keep it running. No upload request reached the API.`
      : 'Network request did not complete. No automatic retry; inspect the local receipt.');
    failure.beforeUpload = refused;
    throw failure;
  }
  must(response.ok, `Request failed with HTTP ${response.status}. No success was recorded.`);
  try { return await response.json(); } catch { throw new Error('Invalid JSON response. No success was recorded.'); }
}

export async function ensureUploadApiReady(fetcher = fetch, apiBase = api) {
  const value = await jsonRequest(`${apiBase}/health`, {}, fetcher);
  must(value?.status === 'ok', `Backend at ${apiBase} did not pass the health check. No upload was started.`);
  try {
    const categories = await jsonRequest(`${apiBase}/api/categories`, {}, fetcher);
    must(Array.isArray(categories), 'Invalid catalog response.');
  } catch {
    throw new Error(`Backend at ${apiBase} is running but cannot read Supabase. Start the backend in your normal Windows terminal, outside the Codex sandbox. No upload was started.`);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const { apply, apiBase } = parseOptions(argv);
  const settings = parseConfigJson(await readFile(join(process.env.APPDATA, 'Microsoft/UserSecrets/event-platform-api/secrets.json'), 'utf8'));
  must(settings['Supabase:Url']?.replace(/\/$/, '') === base, 'Backend project does not match the confirmed project.');
  must(settings['Supabase:AnonKey'] && settings['Supabase:ServiceRoleKey'], 'Missing backend Supabase configuration.');
  const publicKey = settings['Supabase:AnonKey'];
  const readRows = async (table, columns, key) => {
    const result = [];
    for (let offset = 0; ; offset += 500) {
      const query = new URLSearchParams({ select: columns, limit: '500', offset: String(offset), order: 'id' });
      const { value } = await demoRequest(base, `/rest/v1/${table}?${query}`, key);
      must(Array.isArray(value), 'Catalog query returned an invalid list.');
      result.push(...value);
      if (value.length < 500) return result;
    }
  };
  const counts = {};
  const events = await readRows('events', 'id,title,slug,tenant_id,cover_image_url,status', publicKey);
  counts.events = { visible: events.length, missing: events.filter((row) => !hasImage(row)).map(({ id, title }) => ({ id, title })) };
  for (const [table, column] of [['organizations', 'logo_url'], ['venues', 'map_image_url'], ['profiles', 'avatar_url']]) {
    const rows = await readRows(table, `id,${column}`, settings['Supabase:ServiceRoleKey']);
    counts[table] = { total: rows.length, missing: rows.filter((row) => !row[column]?.trim()).length };
  }
  console.log(JSON.stringify({ project, audit: counts, note: 'Map images, personal avatars, KYC and evidence are not generated or changed.' }, null, 2));
  if (!apply) return;
  must(settings['MediaStorage:ImageProvider'] === 'Cloudinary' && settings['Cloudinary:CloudName'], 'Cloudinary must be explicitly configured in API user-secrets.');
  await ensureUploadApiReady(fetch, apiBase);
  const manifest = parseConfigJson(await readFile(join(root, 'assets/catalog/manifest.json'), 'utf8'));
  const data = parseConfigJson(await readFile(join(root, 'supabase/imports/platform-demo.dataset.json'), 'utf8'));
  const imported = readDemoState(await readFile(join(root, 'supabase/imports/local/platform-demo.import-state.json'), 'utf8'));
  must(manifest.projectRef === project && imported.projectRef === project && manifest.formatVersion === 1 && Array.isArray(manifest.assets), 'Artwork/import manifest project mismatch.');
  must(imported.datasetHash === createHash('sha256').update(JSON.stringify(data)).digest('hex'), 'Import journal does not match this dataset.');
  const checked = [];
  const seen = new Set();
  for (const asset of manifest.assets) {
    must(!seen.has(asset.eventKey) && /^[a-z0-9-]+\.png$/.test(asset.file), 'Duplicate event or unsafe artwork file.');
    seen.add(asset.eventKey);
    const source = data.events.find((event) => event.key === asset.eventKey);
    const org = data.organizations.find((item) => item.key === source?.organization);
    const id = imported.eventIds?.[asset.eventKey];
    const row = events.find((event) => event.id === id);
    const orgId = imported.steps?.[`org-${org?.key}`]?.result;
    must(source && org && row && row.tenant_id === orgId && [source.slug, cleanSlug(source.slug)].includes(row.slug) && [source.title, cleanLabel(source.title)].includes(row.title), 'Event identity or organization changed; refusing to write.');
    const bytes = await readFile(join(root, 'assets/catalog', asset.file));
    const hash = createHash('sha256').update(bytes).digest('hex');
    must(hash === asset.sha256 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.length <= 10 * 1024 * 1024, 'Artwork checksum, format or size is invalid.');
    checked.push({ asset, source, org, id, orgId, bytes, hash });
  }
  const statePath = join(root, 'supabase/imports/local/catalog-images.receipt.json');
  await mkdir(dirname(statePath), { recursive: true });
  const lock = await open(`${statePath}.lock`, 'wx');
  try {
    let state;
    try { state = parseConfigJson(await readFile(statePath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; state = { project, events: {} }; }
    must(state.project === project, 'Receipt belongs to another project.');
    const persist = async () => {
      const temp = `${statePath}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify(state, null, 2) + '\n');
      await rename(temp, statePath);
    };
    const tokens = {};
    const tokenFor = async (actor) => {
      if (tokens[actor]) return tokens[actor];
      const expected = imported.steps?.[`auth-${actor}`]?.result;
      const credentials = imported.credentials?.[actor];
      must(expected?.id && credentials?.email === expected.email && /^tickey-demo-owner-[ab]@example\.com$/.test(credentials.email), 'Only the existing dataset owner may authenticate.');
      const { value } = await demoRequest(base, '/auth/v1/token?grant_type=password', publicKey, { method: 'POST', body: credentials });
      must(value?.user?.id === expected.id && value.user.app_metadata?.tickey_demo_dataset === 'tickey-demo-v1' && value.access_token, 'Wrong authenticated account.');
      tokens[actor] = value.access_token;
      return tokens[actor];
    };
    for (const item of checked) {
      state.events[item.id] ??= { sha256: item.hash, previousUrl: null };
      const receipt = state.events[item.id];
      must(receipt.sha256 === item.hash, 'Artwork changed since the last operation; reconcile before replay.');
      const read = async () => {
        const { value } = await demoRequest(base, `/rest/v1/events?${new URLSearchParams({ select: 'id,tenant_id,cover_image_url,status', id: `eq.${item.id}` })}`, publicKey);
        must(Array.isArray(value) && value.length === 1 && value[0].tenant_id === item.orgId, 'Event no longer readable or tenant changed.');
        return value[0];
      };
      const result = await fillMissingCover({ read, receipt, persist,
        upload: async () => {
          const form = new FormData();
          form.set('purpose', 'EVENT_ASSET');
          form.set('orgId', item.orgId);
          form.set('file', new File([item.bytes], item.asset.file, { type: 'image/png' }));
          const value = await jsonRequest(`${apiBase}/api/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${await tokenFor(item.org.actor)}` }, body: form });
          return validateUpload(value, item.orgId, settings['Cloudinary:CloudName']);
        },
        save: async (url) => {
          const { value } = await demoRequest(base, '/rest/v1/rpc/save_event', publicKey, { method: 'POST', token: await tokenFor(item.org.actor), body: { p: { id: item.id, cover_image_url: url } } });
          must(value === item.id, 'save_event returned an unexpected ID.');
        },
      });
      console.log(JSON.stringify({ eventId: item.id, title: cleanLabel(item.source.title), ...result }));
      if (result.status === 'saved') {
        const response = await fetch(result.url, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(20_000) });
        must(response.ok && response.headers.get('content-type')?.startsWith('image/'), 'Saved URL could not be verified as a delivered image.');
        console.log(`Image delivery verified for ${item.id}.`);
      }
    }
  } finally { await lock.close(); await unlink(`${statePath}.lock`); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => { console.error(error instanceof SyntaxError ? 'Invalid JSON configuration.' : error.message); process.exitCode = 1; });
