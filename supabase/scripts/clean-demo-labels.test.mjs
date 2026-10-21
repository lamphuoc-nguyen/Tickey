import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanLabel, cleanSlug, main } from './clean-demo-labels.mjs';

test('cleans display prefixes and sentences while preserving unrelated words', () => {
  assert.equal(cleanLabel('DEMO · Đêm nhạc Thành phố lên đèn'), 'Đêm nhạc Thành phố lên đèn');
  assert.equal(
    cleanLabel('DEMO: dữ liệu giả, không dùng để thanh toán thật.'),
    'dữ liệu giả, không dùng để thanh toán thật.',
  );
  assert.equal(cleanLabel('Sự kiện DEMO, không diễn ra ngoài đời.'), 'Sự kiện mẫu, không diễn ra ngoài đời.');
  assert.equal(cleanLabel('demographics'), 'demographics');
  assert.equal(cleanLabel(null), null);
});
test('clean slugs keep stable event words', () => {
  assert.equal(cleanSlug('tickey-demo-dem-nhac-thanh-pho'), 'dem-nhac-thanh-pho');
  assert.equal(cleanSlug('demo-am-nhac'), 'am-nhac');
  assert.equal(cleanSlug('am-nhac'), 'am-nhac');
});
test('cleanup cannot execute without the exact target confirmation', async () => {
  await assert.rejects(main([]), /Require exact project confirmation/);
  await assert.rejects(main(['--confirm-project', 'another-project']), /Require exact project confirmation/);
});
