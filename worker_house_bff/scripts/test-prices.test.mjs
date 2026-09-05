import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { executePriceChange, parsePriceArguments, planPriceChange, readPriceConnection, validatePriceRow, writePriceSnapshot } from './test-prices.mjs';

const beforeVersion = '2026-09-06T01:00:00.000Z';
const now = '2026-09-06T02:00:00.000Z';
const targetFingerprint = 'f'.repeat(64);
function row(catalog = 'activities') {
  const activity = catalog === 'activities';
  const payload = { id: 'test-item', enabled: true, price: 148, originalPrice: 188,
    ...(activity ? { startDate: '2026-10-01', updatedAt: beforeVersion, sort: 2, maxParticipants: 12,
      signups: [{ phone: 'private-user-data' }] } : { category: 'test', shippingFee: 6, stock: 10, maxQuantity: 2 }) };
  return { [activity ? 'activity_id' : 'product_id']: payload.id, enabled: 1, sort_order: 2, updated_at: beforeVersion,
    ...(activity ? { start_date: payload.startDate } : { stock: payload.stock, category: payload.category }), payload };
}
function plan(catalog = 'activities', changes = {}) {
  return planPriceChange({ catalog, ids: ['test-item'], rows: [row(catalog)], targetFingerprint, now, ...changes });
}

test('test price arguments require explicit exact scope and default to preview', () => {
  assert.deepEqual(parsePriceArguments(['--catalog=products', '--ids=item-b,item-a']), { catalog: 'products', ids: ['item-a', 'item-b'], apply: false });
  for (const args of [[], ['--catalog=all', '--ids=item'], ['--catalog=products', '--ids=*'],
    ['--catalog=products', '--ids=all'], ['--catalog=products', '--ids=a,'], ['--catalog=products', '--ids=a,a'],
    ['--catalog=products', '--ids=a', '--apply'], ['--catalog=products', '--ids=a', '--snapshot=relative.json'],
    ['--catalog=products', '--ids=a', '--apply', '--apply'], ['--catalog=products', '--ids=a', '--snapshot=/a', '--restore=/b']]) {
    assert.throws(() => parsePriceArguments(args));
  }
  assert.throws(() => parsePriceArguments(['--catalog=activities', '--ids=item', '--restore=/backup.json', '--apply']), /confirm-sales-paused/);
  assert.equal(parsePriceArguments(['--catalog=activities', '--ids=item', '--restore=/backup.json', '--apply', '--confirm-sales-paused']).apply, true);
});

test('connection config has no implicit database and never copies credentials into target fingerprints', () => {
  assert.throws(() => readPriceConnection({}));
  assert.throws(() => readPriceConnection({ MYSQL_ADDRESS: 'localhost', MYSQL_USERNAME: 'user', MYSQL_PASSWORD: 'secret' }));
  assert.throws(() => readPriceConnection({ MYSQL_URL: 'mysql://user:secret@host/database?insecure=true' }));
  const first = readPriceConnection({ MYSQL_URL: 'mysql://user:secret@host:3306/database' });
  const second = readPriceConnection({ MYSQL_ADDRESS: 'host:3306', MYSQL_USERNAME: 'other', MYSQL_PASSWORD: 'different', MYSQL_DATABASE: 'database' });
  assert.equal(first.targetFingerprint, second.targetFingerprint);
  assert.doesNotMatch(first.targetFingerprint, /user|secret|host|database/);
  assert.equal(first.options.multipleStatements, false);
});

test('one-cent plans preserve every non-price business field and synchronize activity versions', () => {
  for (const catalog of ['activities', 'products']) {
    const current = row(catalog);
    const result = plan(catalog);
    const expected = { ...current.payload, price: 0.01 };
    if (catalog === 'activities') expected.updatedAt = now;
    assert.deepEqual(result.changes[0].payload, expected);
    assert.equal(current.payload.price, 148);
    assert.equal(result.snapshot.items[0].beforePrice, 148);
    assert.doesNotMatch(JSON.stringify(result.snapshot), /private-user-data|signups|shippingFee|password|MYSQL_URL/);
    assert.equal(plan(catalog, { now: beforeVersion }).changes[0].version, '2026-09-06T01:00:00.001Z');
  }
});

test('row validation refuses indexed-payload drift and invalid currency', () => {
  for (const catalog of ['activities', 'products']) {
    for (const mutate of [
      (value) => { value.payload.id = 'other'; }, (value) => { value.enabled = 0; },
      (value) => { value.payload.price = 0.001; }, (value) => { value.payload.originalPrice = -1; },
      (value) => { value.updated_at = 'invalid'; },
      ...(catalog === 'activities' ? [(value) => { value.start_date = 'other'; }, (value) => { value.sort_order = 3; }]
        : [(value) => { value.stock = 11; }, (value) => { value.category = 'other'; }, (value) => { value.payload.shippingFee = '6'; }]),
    ]) {
      const current = row(catalog); mutate(current);
      assert.throws(() => validatePriceRow(catalog, current));
    }
  }
});

test('already one-cent rows remain no-op without version rewrites or a misleading restoration price', async () => {
  const current = row(); current.payload.price = 0.01;
  const result = plan('activities', { rows: [current] });
  assert.equal(result.changes[0].changed, false);
  assert.equal(result.changes[0].version, beforeVersion);
  assert.equal(result.snapshot.items[0].beforePrice, 0.01);
  const connection = fakeConnection(current);
  const report = await executePriceChange({ connection, targetFingerprint,
    options: parsePriceArguments(['--catalog=activities', '--ids=test-item', '--apply', '--confirm-sales-paused', '--snapshot=/new.json']),
    saveSnapshot: async () => assert.fail('no-op must not create a backup') });
  assert.equal(report.mode, 'no-op');
  assert.ok(connection.calls.every((call) => !call.startsWith('UPDATE')));
});

test('restore requires same database, exact targets, current test price and test version', () => {
  for (const catalog of ['activities', 'products']) {
    const applied = plan(catalog);
    const current = { ...row(catalog), payload: applied.changes[0].payload, updated_at: applied.changes[0].version };
    const restored = plan(catalog, { rows: [current], restoreSnapshot: applied.snapshot });
    assert.equal(restored.changes[0].price, 148);
    assert.ok(restored.changes[0].version > applied.changes[0].version);
    assert.equal(restored.snapshot, null);
    for (const edits of [
      { targetFingerprint: 'another-database' }, { ids: ['different-item'] },
      { rows: [{ ...current, payload: { ...current.payload, price: 12 } }] },
      { rows: [{ ...current, updated_at: '2026-09-07T00:00:00.000Z' }] },
      { restoreSnapshot: { ...applied.snapshot, items: [{ ...applied.snapshot.items[0], beforePrice: -1 }] } },
    ]) assert.throws(() => plan(catalog, { rows: [current], restoreSnapshot: applied.snapshot, ...edits }));
  }
});

function fakeConnection(current = row(), updateError = false) {
  const calls = [];
  return { calls,
    query: async (sql) => { calls.push(sql); },
    beginTransaction: async () => { calls.push('begin'); },
    commit: async () => { calls.push('commit'); }, rollback: async () => { calls.push('rollback'); },
    execute: async (sql, parameters) => {
      calls.push(sql);
      if (sql.startsWith('SELECT seed_version')) return [[{ seed_version: 1 }]];
      if (sql.startsWith('SELECT')) return [[current]];
      assert.equal(sql, "UPDATE worker_house_activities SET payload = JSON_SET(payload, '$.price', ?, '$.updatedAt', ?), updated_at = ? WHERE activity_id = ? AND updated_at = ?");
      assert.equal(parameters[0], 0.01);
      assert.equal(parameters[1], parameters[2]);
      assert.equal(parameters[3], 'test-item');
      assert.equal(parameters[4], beforeVersion);
      if (updateError) throw new Error('simulated database failure');
      return [{ affectedRows: 1 }];
    },
  };
}

test('preview uses read-only transaction without locks, snapshot writes or updates', async () => {
  const connection = fakeConnection();
  const result = await executePriceChange({ connection, targetFingerprint,
    options: parsePriceArguments(['--catalog=activities', '--ids=test-item']),
    saveSnapshot: async () => assert.fail('preview must not write snapshot') });
  assert.equal(result.mode, 'preview');
  assert.equal(connection.calls[0], 'SET TRANSACTION READ ONLY');
  assert.ok(connection.calls.includes('rollback'));
  assert.ok(connection.calls.every((call) => !/UPDATE|FOR SHARE|commit/.test(call)));
  assert.doesNotMatch(JSON.stringify(result), /private-user-data|signups/);
});

test('invalid restore snapshot never becomes a new price-setting operation', async () => {
  for (const restoreSnapshot of [undefined, null, []]) {
    const connection = fakeConnection();
    await assert.rejects(executePriceChange({ connection, targetFingerprint, restoreSnapshot,
      options: parsePriceArguments(['--catalog=activities', '--ids=test-item', '--restore=/backup.json']) }), /valid snapshot/);
    assert.equal(connection.calls.length, 0);
  }
});

test('apply locks targets and saves the original-price snapshot before any update', async () => {
  const connection = fakeConnection();
  const result = await executePriceChange({ connection, targetFingerprint,
    options: parsePriceArguments(['--catalog=activities', '--ids=test-item', '--apply', '--confirm-sales-paused', '--snapshot=/explicit/new.json']),
    saveSnapshot: async (snapshotPath, snapshot) => {
      assert.equal(snapshotPath, '/explicit/new.json');
      assert.equal(snapshot.items[0].beforePrice, 148);
      assert.ok(connection.calls.some((call) => call.endsWith('FOR UPDATE')));
      assert.ok(connection.calls.every((call) => !call.startsWith('UPDATE')));
      connection.calls.push('snapshot-saved');
    } });
  assert.equal(result.mode, 'applied');
  assert.ok(connection.calls.indexOf('snapshot-saved') < connection.calls.findIndex((call) => call.startsWith('UPDATE')));
  assert.equal(connection.calls.at(-1), 'commit');
});

test('backup or database failure rolls back the whole transaction without commit', async () => {
  for (const backupFailure of [true, false]) {
    const connection = fakeConnection(row(), !backupFailure);
    await assert.rejects(executePriceChange({ connection, targetFingerprint,
      options: parsePriceArguments(['--catalog=activities', '--ids=test-item', '--apply', '--confirm-sales-paused', '--snapshot=/explicit/new.json']),
      saveSnapshot: async () => { if (backupFailure) throw new Error('backup disk full'); } }));
    assert.equal(connection.calls.at(-1), 'rollback');
    assert.ok(!connection.calls.includes('commit'));
    if (backupFailure) assert.ok(connection.calls.every((call) => !call.startsWith('UPDATE')));
  }
});

test('snapshot is private, persisted, and refuses to overwrite an existing backup', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'worker-house-price-snapshot-test-'));
  const snapshotPath = path.join(directory, 'snapshot.json');
  const snapshot = plan().snapshot;
  await writePriceSnapshot(snapshotPath, snapshot);
  assert.deepEqual(JSON.parse(await readFile(snapshotPath, 'utf8')), snapshot);
  if (process.platform !== 'win32') assert.equal((await stat(snapshotPath)).mode & 0o777, 0o600);
  await assert.rejects(writePriceSnapshot(snapshotPath, { overwrite: true }), { code: 'EEXIST' });
  assert.deepEqual(JSON.parse(await readFile(snapshotPath, 'utf8')), snapshot);
});
