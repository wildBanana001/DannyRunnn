import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const integrationFiles = [
  'dist/data/mysql-catalogs.integration.test.js',
  'dist/data/mysql-orders.integration.test.js',
  'scripts/test-prices.integration.test.mjs',
];

export function requireMysqlTestUrl(value) {
  const connectionUrl = typeof value === 'string' ? value.trim() : '';
  assert.ok(connectionUrl, 'MYSQL_TEST_URL is required; real MySQL integration tests cannot be skipped.');
  let url;
  try {
    url = new URL(connectionUrl);
  } catch {
    throw new Error('MYSQL_TEST_URL must be a valid MySQL connection URL.');
  }
  assert.equal(url.protocol, 'mysql:', 'MYSQL_TEST_URL must use the mysql: protocol.');
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  assert.match(databaseName, /(?:^|[_-])test(?:$|[_-])/i,
    'MYSQL_TEST_URL must name a dedicated test database, for example worker_house_test.');
  return connectionUrl;
}

export function requireCompleteMysqlTestReport(output) {
  const summaryCount = (field) => {
    const matches = [...output.matchAll(new RegExp(`^# ${field} (\\d+)\\r?$`, 'gm'))];
    assert.ok(matches.length, `MySQL integration test report is missing the ${field} summary.`);
    return Number(matches.at(-1)[1]);
  };
  // Three database cases and the dedicated-database guard must execute.
  assert.ok(summaryCount('tests') >= 4, 'MySQL integration test suite did not execute all required cases.');
  for (const field of ['fail', 'cancelled', 'skipped', 'todo']) {
    assert.equal(summaryCount(field), 0, `MySQL integration tests reported ${field}; the gate cannot pass.`);
  }
}

function main() {
  const connectionUrl = requireMysqlTestUrl(process.env.MYSQL_TEST_URL);
  const result = spawnSync(process.execPath, [
    '--test',
    '--test-concurrency=1',
    '--test-reporter=tap',
    ...integrationFiles,
  ], {
    cwd: projectDirectory,
    env: { ...process.env, MYSQL_TEST_URL: connectionUrl },
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.ifError(result.error);
  assert.equal(result.status, 0, 'Real MySQL integration tests failed.');
  requireCompleteMysqlTestReport(result.stdout);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
