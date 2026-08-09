import assert from 'node:assert/strict';
import test from 'node:test';
import { readBoolean } from './config.js';

test('only enables server feature flags for an explicit true value', () => {
  assert.equal(readBoolean('true'), true);
  assert.equal(readBoolean(' TRUE '), true);
  assert.equal(readBoolean('false'), false);
  assert.equal(readBoolean('1'), false);
  assert.equal(readBoolean(undefined), false);
});
