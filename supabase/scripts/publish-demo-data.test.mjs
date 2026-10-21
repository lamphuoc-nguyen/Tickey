import { test } from 'node:test';
import assert from 'node:assert/strict';
import { declarationText, demoReviewNote, main } from './publish-demo-data.mjs';

test('publication declaration explicitly denies being real legal evidence', () => {
  const text = declarationText({ slug: 'tickey-demo-am-sac', name: 'DEMO · Trung tâm Âm Sắc' });
  assert.match(text, /NOT LEGAL EVIDENCE/);
  assert.match(text, /Document type: OTHER/);
  assert.match(text, /NOT a business license/);
  assert.match(text, /Do not use this organization for real selling/);
  assert.match(demoReviewNote(), /Not legal\/business\/identity verification/);
});
test('unmarked organizations and missing target confirmation are rejected', async () => {
  assert.throws(() => declarationText({ slug: 'real-org', name: 'Real organization' }));
  assert.throws(() => declarationText({ slug: 'tickey-demo-x', name: 'Real organization' }));
  await assert.rejects(main([]), /Require --confirm-project/);
  await assert.rejects(main(['--confirm-project', 'other-project']), /Require --confirm-project/);
});
