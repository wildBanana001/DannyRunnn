import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateRuntimeRequest, type RuntimeGateContext } from './runtime-gate.js';

const productionContext: RuntimeGateContext = {
  allowEphemeralCloudrunData: false,
  cloudMode: 'cloudrun',
  enableShop: true,
  hasWechatCloudConfig: true,
  shopOrderStorage: 'mysql',
};

test('allows public poster reads in locked-down CloudRun without opening poster writes', () => {
  assert.equal(evaluateRuntimeRequest('/posters', 'GET', productionContext), true);
  assert.equal(evaluateRuntimeRequest('/posters/poster-001', 'GET', productionContext), true);
  assert.equal(evaluateRuntimeRequest('/posters', 'POST', productionContext), false);
  assert.equal(evaluateRuntimeRequest('/posters/poster-001', 'DELETE', productionContext), false);
  assert.equal(evaluateRuntimeRequest('/posters', 'GET', {
    ...productionContext,
    hasWechatCloudConfig: false,
  }), false);
});

test('allows MySQL-backed activity reads and authenticated CRUD paths only', () => {
  for (const [path, method] of [
    ['/activities', 'GET'],
    ['/activities', 'POST'],
    ['/activities/act-001', 'GET'],
    ['/activities/act-001', 'PUT'],
    ['/activities/act-001', 'DELETE'],
    ['/admin-mini/activities', 'GET'],
    ['/admin-mini/activities', 'POST'],
    ['/admin-mini/activities/act-001', 'GET'],
    ['/admin-mini/activities/act-001', 'PUT'],
    ['/admin-mini/activities/act-001', 'DELETE'],
  ] as const) {
    assert.equal(evaluateRuntimeRequest(path, method, productionContext), true, `${method} ${path}`);
  }
  assert.equal(evaluateRuntimeRequest('/activities/act-001/signup', 'POST', productionContext), false);
  assert.equal(evaluateRuntimeRequest('/activities', 'GET', {
    ...productionContext,
    shopOrderStorage: 'file',
  }), false);
});
