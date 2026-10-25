const assert = require('node:assert/strict');
const test = require('node:test');
const { emptyActivityForm, importedActivityForm, buildActivityPayload } = require('../src/utils/adminActivity.ts');

function completeForm(overrides = {}) {
  return { ...emptyActivityForm(), title: '一起手作', description: '周末相聚', fullDescription: '一起学习手作，认识新的朋友。', coverImage: 'https://example.com/cover.jpg',
    startDate: '2099-11-08', endDate: '2099-11-08', startTime: '14:00', endTime: '16:00',
    location: '社畜之家', price: '88.50', maxParticipants: '20', ...overrides };
}

test('unknown import amounts remain blank and explicit zero remains free', () => {
  const draft = { ...emptyActivityForm(), gallery: [], price: null, maxParticipants: null };
  assert.equal(importedActivityForm({ draft, warnings: [] }).price, '');
  assert.equal(importedActivityForm({ draft: { ...draft, price: 0 }, warnings: [] }).price, '0');
  assert.throws(() => buildActivityPayload(completeForm({ price: '' }), true), /单价/);
});

test('editor enforces calendar, capacity, money and image constraints', () => {
  for (const override of [{ startDate: '2099-02-30' }, { endTime: '12:00' }, { price: '1.001' }, { maxParticipants: '0' }, { maxParticipants: '2.5' }, { coverImage: 'javascript:alert(1)' }, { gallery: 'data:image/png;base64,abc' }]) {
    assert.throws(() => buildActivityPayload(completeForm(override), true));
  }
  assert.throws(() => buildActivityPayload(completeForm({ startDate: '2020-11-08', endDate: '2020-11-08' }), true), /已经结束/);
});

test('publishing is explicit and editing does not overwrite registrations or server-owned metadata', () => {
  const payload = buildActivityPayload(completeForm(), false);
  assert.equal(payload.enabled, false);
  assert.equal(payload.price, 88.5);
  assert.equal(payload.maxParticipants, 20);
  for (const field of ['id', 'signups', 'currentParticipants', 'createdAt', 'updatedAt']) assert.equal(field in payload, false);
  assert.equal(buildActivityPayload(completeForm(), true).enabled, true);
});
