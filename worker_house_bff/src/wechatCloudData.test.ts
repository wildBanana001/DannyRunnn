import assert from 'node:assert/strict';
import test from 'node:test';
import { toCloudQueryLiteral } from './wechatCloudData.js';

test('escapes untrusted values before embedding them in cloud database commands', () => {
  const input = `x'); db.collection('admins').where({}).remove(); //\n\u2028`;
  const literal = toCloudQueryLiteral(input);
  assert.equal(JSON.parse(literal), input);
  assert.equal(literal.includes('\\n'), true);
  assert.equal(literal.includes('\\u2028'), true);
});
