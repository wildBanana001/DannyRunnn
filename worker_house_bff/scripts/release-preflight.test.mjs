import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { checkRelease, parseReleaseTarget } from './release-preflight.mjs';

function responses(shopEnabled = false) {
  return {
    '/health': [200, { status: 'ok' }],
    '/api/health': [503, { status: 'configuration_required', mode: 'cloudrun', persistence: 'mysql-orders+catalogs', shop: { orderStorage: 'mysql', enabled: shopEnabled } }],
    '/api/shop/readiness': [200, { ready: true, mode: 'cloudrun', orderStorage: { type: 'mysql', ready: true }, payment: { ready: true }, orderShipping: { ready: true } }],
    '/api/site-config': [200, { communityWallEnabled: false }],
    '/api/activities?pageSize=100': [200, { list: [{ id: 'activity', enabled: true, price: 12 }], total: 1 }],
    '/api/shop/products': [200, { list: [{ id: 'product', enabled: true, price: 8, stock: 2 }], total: 1 }],
  };
}

async function run(fixtures, options = {}) {
  const calls = [];
  const result = await checkRelease({ baseUrl: 'https://bff.example', ...options, fetchImpl: async (url, init) => {
    const path = url.slice('https://bff.example'.length);
    calls.push(path);
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.deepEqual(init.headers, { Accept: 'application/json' });
    assert.ok(init.signal instanceof AbortSignal);
    const [status, body] = fixtures[path];
    return { status, json: async () => body };
  } });
  assert.equal(calls.length, 6);
  return result;
}

test('release target rejects credentials, non-HTTPS remote origins and ambiguous paths', () => {
  assert.equal(parseReleaseTarget('https://bff.example'), 'https://bff.example');
  assert.equal(parseReleaseTarget('http://127.0.0.1:4000'), 'http://127.0.0.1:4000');
  for (const value of [undefined, '', 'http://remote.example', 'https://user:secret@bff.example', 'https://bff.example/api', 'https://bff.example?token=secret', 'https://bff.example/#fragment']) {
    assert.throws(() => parseReleaseTarget(value));
  }
});

test('closed-sales preflight accepts expected legacy HTTP 503 and uses only public GET routes', async () => {
  assert.equal((await run(responses())).passed, true);
});

test('open-sales preflight requires the explicit open switch', async () => {
  assert.equal((await run(responses(true), { expectShop: 'open' })).passed, true);
  assert.equal((await run(responses(), { expectShop: 'open' })).passed, false);
  assert.equal((await run(responses(true))).passed, false);
  await assert.rejects(checkRelease({ baseUrl: 'https://bff.example', expectShop: 'unknown' }));
});

test('mock, filesystem escape hatch, missing dependency and malformed catalogs fail closed', async () => {
  for (const modify of [
    (data) => { data['/api/health'][1].mode = 'mock'; },
    (data) => { data['/api/health'][0] = 200; data['/api/health'][1].status = 'ok'; },
    (data) => { data['/api/shop/readiness'][1].orderStorage.type = 'file'; },
    (data) => { data['/api/shop/readiness'][1].payment.ready = false; },
    (data) => { data['/api/site-config'][1].communityWallEnabled = 'true'; },
    (data) => { data['/api/shop/products'][1].list[0].enabled = false; },
    (data) => { data['/api/activities?pageSize=100'][1].total = -1; },
  ]) {
    const fixtures = responses();
    modify(fixtures);
    assert.equal((await run(fixtures)).passed, false);
  }
});

test('business policy warnings do not silently approve prices or inventory', async () => {
  const fixtures = responses();
  fixtures['/api/shop/products'][1].list[0].price = 0.01;
  fixtures['/api/shop/products'][1].list[0].stock = null;
  const report = await run(fixtures);
  assert.equal(report.passed, true);
  assert.equal(report.warnings.length, 2);
  assert.match(report.scope, /not payment settlement/);
});

test('explicit one-cent acceptance rejects stale database pricing without altering records', async () => {
  const fixtures = responses();
  assert.equal((await run(fixtures, { expectTestPrices: true })).passed, false);
  fixtures['/api/activities?pageSize=100'][1].list[0].price = 0.01;
  fixtures['/api/shop/products'][1].list[0].price = 0.01;
  const report = await run(fixtures, { expectTestPrices: true });
  assert.equal(report.passed, true);
  assert.equal(report.expectedUnitPrice, 0.01);
  assert.equal(report.warnings.length, 0);
});

test('network and non-JSON failures are reported without response details or secrets', async () => {
  for (const fetchImpl of [
    async () => { throw new Error('secret'); },
    async () => ({ status: 200, json: async () => { throw new Error('secret HTML response'); } }),
  ]) {
    const report = await checkRelease({ baseUrl: 'https://bff.example', fetchImpl });
    assert.equal(report.passed, false);
    assert.equal(report.checks.length, 6);
    assert.doesNotMatch(JSON.stringify(report), /secret/);
  }
});

test('preflight works end-to-end against an HTTP loopback fixture server', async (t) => {
  const fixtures = responses();
  const calls = [];
  const server = createServer((request, response) => {
    calls.push({ method: request.method, path: request.url });
    const [status, body] = fixtures[request.url] || [404, {}];
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const report = await checkRelease({ baseUrl: `http://127.0.0.1:${server.address().port}` });
  assert.equal(report.passed, true);
  assert.deepEqual(calls, Object.keys(fixtures).map((path) => ({ method: 'GET', path })));
});
