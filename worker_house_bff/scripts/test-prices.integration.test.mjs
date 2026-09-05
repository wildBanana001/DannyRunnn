import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireMysqlTestUrl } from './run-mysql-integration-tests.mjs';
import { executePriceChange, parsePriceArguments, readPriceConnection } from './test-prices.mjs';

const testUrl = process.env.MYSQL_TEST_URL?.trim() || '';

test('real MySQL test pricing previews, applies, restores, and rejects stale restoration atomically', { skip: !testUrl }, async (t) => {
  // Never read MYSQL_URL: an accidental production environment must not select the test target.
  const safeTestUrl = requireMysqlTestUrl(testUrl);
  const mysql = await import('mysql2/promise');
  const configuration = readPriceConnection({ MYSQL_URL: safeTestUrl });
  const connection = await mysql.default.createConnection(configuration.options);
  const prefix = `price-test-${randomUUID()}`;
  const directory = await mkdtemp(path.join(tmpdir(), 'worker-house-price-mysql-test-'));
  const fixtureIds = [];
  t.after(async () => {
    try {
      for (const { table, key, id } of fixtureIds) {
        await connection.execute(`DELETE FROM ${table} WHERE ${key} = ?`, [id]);
      }
    } finally { await connection.end(); }
  });
  // This dedicated test database has the production schema but never production data.
  // No DROP, TRUNCATE or business seed import is used; cleanup deletes only UUID fixture IDs.
  const schema = await readFile(new URL('../sql/002_mysql_catalog_storage.sql', import.meta.url), 'utf8');
  for (const statement of schema.split(';').map((part) => part.trim()).filter(Boolean)) await connection.query(statement);

  for (const catalog of ['activities', 'products']) {
    const activity = catalog === 'activities';
    const table = activity ? 'worker_house_activities' : 'worker_house_shop_products';
    const key = activity ? 'activity_id' : 'product_id';
    const ids = [`${prefix}-${catalog}-a`, `${prefix}-${catalog}-b`];
    const originalVersion = '2026-09-06T00:00:00.000Z';
    const originalPayloads = new Map();
    await connection.execute(
      "INSERT IGNORE INTO worker_house_catalog_state (catalog_name, seed_version, seeded_at) VALUES (?, 1, ?)",
      [catalog, originalVersion],
    );
    for (const id of ids) {
      const payload = { id, enabled: true, price: 12.5, originalPrice: 18,
        ...(activity ? { startDate: '2026-10-01', sort: 0, updatedAt: originalVersion, maxParticipants: 9 }
          : { category: 'test', shippingFee: 3, stock: 7, maxQuantity: 2 }) };
      originalPayloads.set(id, payload);
      const extraColumns = activity ? 'start_date' : 'category, stock';
      const extraValues = activity ? ['2026-10-01'] : ['test', 7];
      await connection.execute(
        `INSERT INTO ${table} (${key}, enabled, sort_order, updated_at, payload, ${extraColumns}) VALUES (?, 1, 0, ?, ?, ${extraValues.map(() => '?').join(', ')})`,
        [id, originalVersion, JSON.stringify(payload), ...extraValues],
      );
      fixtureIds.push({ table, key, id });
    }
    const readCurrent = async (id) => {
      const [[current]] = await connection.execute(`SELECT payload, updated_at FROM ${table} WHERE ${key} = ?`, [id]);
      return { ...current, payload: typeof current.payload === 'string' ? JSON.parse(current.payload) : current.payload };
    };
    const args = [`--catalog=${catalog}`, `--ids=${ids.join(',')}`];
    const run = (extraArgs, restoreSnapshot) => executePriceChange({ connection,
      options: parsePriceArguments([...args, ...extraArgs]), targetFingerprint: configuration.targetFingerprint, restoreSnapshot });
    assert.equal((await run([])).mode, 'preview');
    assert.equal((await readCurrent(ids[0])).updated_at, originalVersion);
    assert.equal((await readCurrent(ids[0])).payload.price, 12.5);

    const snapshotPath = path.join(directory, `${catalog}.json`);
    assert.equal((await run(['--apply', '--confirm-sales-paused', `--snapshot=${snapshotPath}`])).mode, 'applied');
    const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
    assert.doesNotMatch(JSON.stringify(snapshot), /mysql:\/\/|password|shippingFee|stock/);
    for (const id of ids) {
      const current = await readCurrent(id);
      const expected = { ...originalPayloads.get(id), price: 0.01 };
      if (activity) expected.updatedAt = current.updated_at;
      assert.deepEqual(current.payload, expected);
    }
    assert.equal((await run([`--restore=${snapshotPath}`], snapshot)).mode, 'preview');
    assert.equal((await readCurrent(ids[0])).payload.price, 0.01);
    assert.equal((await run(['--apply', '--confirm-sales-paused', `--restore=${snapshotPath}`], snapshot)).mode, 'applied');
    assert.equal((await readCurrent(ids[0])).payload.price, 12.5);

    const secondSnapshotPath = path.join(directory, `${catalog}-round-two.json`);
    await run(['--apply', '--confirm-sales-paused', `--snapshot=${secondSnapshotPath}`]);
    const secondSnapshot = JSON.parse(await readFile(secondSnapshotPath, 'utf8'));
    const changedVersion = '2099-01-01T00:00:00.000Z';
    await connection.execute(
      `UPDATE ${table} SET payload = JSON_SET(payload, '$.price', 15${activity ? ", '$.updatedAt', ?" : ''}), updated_at = ? WHERE ${key} = ?`,
      [...(activity ? [changedVersion] : []), changedVersion, ids[1]],
    );
    await assert.rejects(run(['--apply', '--confirm-sales-paused', `--restore=${secondSnapshotPath}`], secondSnapshot), /Restore conflict/);
    assert.equal((await readCurrent(ids[0])).payload.price, 0.01, 'earlier rows must not be partially restored');
    assert.equal((await readCurrent(ids[1])).payload.price, 15, 'later operational price must remain intact');
  }
});
