import test from 'node:test';
import assert from 'node:assert/strict';
import { fillMissingCover, validateUpload, jsonRequest, ensureUploadApiReady, parseOptions } from './complete-catalog-images.mjs';

const uploaded = { bucket: 'event-assets', path: 'org/cloudinary/' + 'a'.repeat(32) + '.png', public_url: 'https://res.cloudinary.com/cloud/image/upload/v1/event.png' };

test('preserves an existing cover without upload or save', async () => {
  const result = await fillMissingCover({ read: async () => ({ cover_image_url: 'https://existing/image.png' }), receipt: {}, upload: () => assert.fail('upload'), save: () => assert.fail('save'), persist: () => assert.fail('persist') });
  assert.equal(result.status, 'preserved');
});

test('persists intent before upload and verifies the server record after saving', async () => {
  const receipt = {};
  let current = { status: 'PUBLISHED', cover_image_url: null };
  const calls = [];
  const result = await fillMissingCover({ receipt, read: async () => current, persist: async () => calls.push('persist'), upload: async () => { assert.equal(receipt.uploadStarted, true); assert.equal(calls[0], 'persist'); calls.push('upload'); return uploaded; }, save: async (url) => { assert.equal(receipt.upload.public_url, url); calls.push('save'); current = { ...current, cover_image_url: url }; } });
  assert.equal(result.status, 'saved');
  assert.equal(receipt.saved, true);
  assert.equal(calls.filter((call) => call === 'upload').length, 1);
});

test('does not re-upload after losing the upload response', async () => {
  await assert.rejects(fillMissingCover({ receipt: { uploadStarted: true }, read: async () => ({ status: 'PUBLISHED', cover_image_url: null }), persist: async () => {}, upload: () => assert.fail('duplicate upload'), save: () => assert.fail('save') }), /unknown/);
});

test('can resume a confirmed upload without uploading again', async () => {
  const receipt = { uploadStarted: true, upload: uploaded };
  let row = { status: 'PUBLISHED', cover_image_url: null };
  const result = await fillMissingCover({ receipt, read: async () => row, persist: async () => {}, upload: () => assert.fail('duplicate upload'), save: async (url) => { row = { ...row, cover_image_url: url }; } });
  assert.equal(result.status, 'saved');
});

test('a cover filled by another operator during upload is preserved', async () => {
  let reads = 0;
  const result = await fillMissingCover({ receipt: {}, read: async () => ++reads === 1 ? { status: 'PUBLISHED', cover_image_url: null } : { status: 'PUBLISHED', cover_image_url: 'https://other/image.png' }, upload: async () => uploaded, save: () => assert.fail('overwrite'), persist: async () => {} });
  assert.equal(result.url, 'https://other/image.png');
  assert.equal(result.status, 'preserved');
});

test('upload errors never become successful saves', async () => {
  const receipt = {};
  await assert.rejects(fillMissingCover({ receipt, read: async () => ({ status: 'PUBLISHED', cover_image_url: null }), upload: async () => { throw new Error('offline'); }, save: () => assert.fail('save'), persist: async () => {} }), /offline/);
  assert.equal(receipt.saved, undefined);
  assert.equal(receipt.uploadStarted, true);
});

test('requires the saved URL to be returned by the server', async () => {
  const receipt = { upload: uploaded };
  await assert.rejects(fillMissingCover({ receipt, read: async () => ({ status: 'PUBLISHED', cover_image_url: null }), upload: () => assert.fail('upload'), save: async () => {}, persist: async () => {} }), /did not confirm/);
  assert.equal(receipt.saved, undefined);
});

test('does not modify events pending review or missing from the catalog', async () => {
  for (const row of [null, { status: 'PENDING_REVIEW', cover_image_url: null }]) {
    await assert.rejects(fillMissingCover({ receipt: {}, read: async () => row, upload: () => assert.fail('upload'), save: () => assert.fail('save'), persist: async () => {} }), /cannot currently be edited/);
  }
});

test('accepts only Cloudinary event uploads belonging to the expected organization', () => {
  assert.equal(validateUpload(uploaded, 'org', 'cloud'), uploaded);
  for (const value of [
    { ...uploaded, bucket: 'kyc-private' },
    { ...uploaded, path: 'other/cloudinary/' + 'a'.repeat(32) + '.png' },
    { ...uploaded, public_url: 'https://res.cloudinary.com/another/image/upload/v1/image.png' },
    { ...uploaded, public_url: 'https://res.cloudinary.com.attacker.test/cloud/image/upload/image.png' },
    { ...uploaded, public_url: 'javascript:alert(1)' },
    { ...uploaded, public_url: null },
  ]) assert.throws(() => validateUpload(value, 'org', 'cloud'));
});

test('connection refusal before sending a file releases intent and gives an actionable backend error', async () => {
  const receipt = {};
  let persisted = 0;
  const refused = async () => { throw new TypeError('fetch failed', { cause: Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }) }); };
  await assert.rejects(fillMissingCover({ receipt, read: async () => ({ status: 'PUBLISHED', cover_image_url: null }), upload: () => jsonRequest('http://127.0.0.1:5080/api/uploads', {}, refused), save: () => assert.fail('save'), persist: async () => { persisted++; } }), /Start the API/);
  assert.equal(receipt.uploadStarted, false);
  assert.equal(persisted, 2);
});

test('aggregate connection refusal is safe to retry but a timeout keeps uncertain intent', async () => {
  const refusal = new AggregateError([Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })]);
  await assert.rejects(jsonRequest('http://127.0.0.1:5080/api/uploads', {}, async () => { throw new TypeError('fetch failed', { cause: refusal }); }), (error) => error.beforeUpload === true);
  const receipt = {};
  await assert.rejects(fillMissingCover({ receipt, read: async () => ({ status: 'PUBLISHED', cover_image_url: null }), upload: () => jsonRequest('http://127.0.0.1:5080/api/uploads', {}, async () => { throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }); }), save: () => assert.fail('save'), persist: async () => {} }), /No automatic retry/);
  assert.equal(receipt.uploadStarted, true);
});

test('backend readiness checks health and real catalog connectivity without uploading', async () => {
  let calls = 0;
  await ensureUploadApiReady(async (url, options) => {
    calls++;
    assert.equal(options.body, undefined);
    if (calls === 1) {
      assert.equal(url, 'http://127.0.0.1:5080/health');
      return Response.json({ status: 'ok' });
    }
    assert.equal(url, 'http://127.0.0.1:5080/api/categories');
    return Response.json([]);
  });
  assert.equal(calls, 2);
  await assert.rejects(ensureUploadApiReady(async () => Response.json({ status: 'failed' })), /No upload was started/);
});

test('a healthy process with a broken Supabase connection fails preflight before uploading', async () => {
  for (const failure of ['tls', 'malformed']) {
    await assert.rejects(ensureUploadApiReady(async (url) => {
      if (url.endsWith('/health')) return Response.json({ status: 'ok' });
      if (failure === 'tls') throw new Error('TLS credential error');
      return Response.json({ error: 'unavailable' });
    }), /cannot read Supabase.*No upload was started/);
  }
});

test('a separate local API port is explicit and credentials cannot be sent to external hosts', () => {
  assert.deepEqual(parseOptions(['apply', '--confirm-project', 'ddourrslmudoqevqlvpv', '--api-url', 'http://127.0.0.1:5081']), { apply: true, apiBase: 'http://127.0.0.1:5081' });
  assert.equal(parseOptions([]).apply, false);
  for (const args of [
    ['apply'],
    ['apply', '--confirm-project', 'wrong'],
    ['plan', '--api-url', 'https://external.example'],
    ['plan', '--api-url', 'http://127.0.0.1:5081/path'],
    ['plan', '--api-url', 'http://user:password@127.0.0.1:5081'],
    ['plan', '--api-url', 'http://127.0.0.1:5081', '--api-url', 'http://127.0.0.1:5082'],
  ]) assert.throws(() => parseOptions(args));
});
