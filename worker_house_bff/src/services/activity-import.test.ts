import assert from 'node:assert/strict';
import test from 'node:test';
import { importActivityArticle, parseActivityText } from './activity-import.js';

const article = `周末的手作相聚
一起动手，认识新的朋友。
活动时间：2027年11月08日 14:00-16:30
活动地点：社畜之家
详细地址：测试路 18 号
活动费用：99元/人
活动人数：20人
主理人：小林
退款说明：开始前一天可申请退款。`;

test('extracts a complete labeled Chinese article without inventing sale-critical fields', () => {
  const { draft, warnings } = parseActivityText(article);
  assert.equal(draft.title, '周末的手作相聚');
  assert.equal(draft.description, '一起动手，认识新的朋友。');
  assert.equal(draft.startDate, '2027-11-08');
  assert.equal(draft.endDate, '2027-11-08');
  assert.equal(draft.startTime, '14:00');
  assert.equal(draft.endTime, '16:30');
  assert.equal(draft.price, 99);
  assert.equal(draft.maxParticipants, 20);
  assert.equal(draft.location, '社畜之家');
  assert.equal(draft.address, '测试路 18 号');
  assert.equal(draft.fullDescription, article);
  assert.equal(warnings.length, 1, 'plain text has no image');
  assert.equal('enabled' in draft, false, 'import is not publication');
});

test('keeps uncertain dates, times, tiered prices and capacities empty for review', () => {
  const { draft } = parseActivityText(`一起聚会认识朋友\n活动时间：11月8日 下午\n费用：早鸟99元，原价129元\n人数：10-20人`);
  assert.equal(draft.startDate, '');
  assert.equal(draft.startTime, '');
  assert.equal(draft.price, null);
  assert.equal(draft.maxParticipants, null);
  assert.equal(parseActivityText(article.replace('99元/人', '99-129元')).draft.price, null);
  assert.equal(parseActivityText(article.replace('99元/人', '9.999元')).draft.price, null);
  assert.equal(parseActivityText(article.replace('2027年11月08日', '2027年02月30日')).draft.startDate, '');
  assert.equal(parseActivityText(article.replace('2027年11月08日', '2027年11月08日-09日')).draft.endDate, '');
  assert.equal(parseActivityText(article.replace('99元/人', '免费')).draft.price, 0);
});

test('supports a label on a separate line and two explicit calendar dates', () => {
  const { draft } = parseActivityText(article.replace('活动时间：2027年11月08日 14:00-16:30', '【活动时间】\n2027-11-08 14:00 至 2027-11-09 16:30'));
  assert.equal(draft.endDate, '2027-11-09');
  assert.equal(draft.endTime, '16:30');
});

test('accepts copied body text and rejects article links without fetching them', async () => {
  assert.equal((await importActivityArticle({ type: 'text', content: article })).draft.price, 99);
  await assert.rejects(importActivityArticle({ type: 'url', content: 'https://mp.weixin.qq.com/s/example' }), /仅支持粘贴推文正文/);
  await assert.rejects(importActivityArticle({ type: 'text', content: 'https://mp.weixin.qq.com/s/example' }), /正文.*链接/);
  await assert.rejects(importActivityArticle({ type: 'unknown', content: article }), /仅支持粘贴推文正文/);
});

test('validates empty, short and oversized copied body text', async () => {
  for (const input of [null, { type: 'text' }, { type: 'text', content: '   ' }]) {
    await assert.rejects(importActivityArticle(input), /正文/);
  }
  await assert.rejects(importActivityArticle({ type: 'text', content: '几字正文' }), /太短/);
  await assert.rejects(importActivityArticle({ type: 'text', content: 'x'.repeat(20001) }), /20000/);
});
