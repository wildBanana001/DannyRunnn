import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { requireCompleteMysqlTestReport, requireMysqlTestUrl } from './run-mysql-integration-tests.mjs';

const successfulReport = `TAP version 13
1..4
# tests 4
# suites 0
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
`;

test('MySQL gate accepts only an explicit, dedicated test database', () => {
  for (const value of [undefined, '', '  ']) {
    assert.throws(() => requireMysqlTestUrl(value), /MYSQL_TEST_URL is required/);
  }
  for (const database of ['worker_house', 'contest', 'production']) {
    assert.throws(() => requireMysqlTestUrl(`mysql://user:password@localhost/${database}`), /dedicated test database/);
  }
  assert.throws(() => requireMysqlTestUrl('https://localhost/worker_house_test'), /mysql: protocol/);
  assert.equal(requireMysqlTestUrl(' mysql://user:password@localhost/worker_house_test '),
    'mysql://user:password@localhost/worker_house_test');
});

test('MySQL gate rejects skipped, failed, cancelled, incomplete, and todo test runs', () => {
  assert.doesNotThrow(() => requireCompleteMysqlTestReport(successfulReport));
  for (const field of ['fail', 'cancelled', 'skipped', 'todo']) {
    assert.throws(() => requireCompleteMysqlTestReport(successfulReport.replace(`# ${field} 0`, `# ${field} 1`)),
      new RegExp(`reported ${field}`));
  }
  assert.throws(() => requireCompleteMysqlTestReport(successfulReport.replace('# tests 4', '# tests 3')), /all required cases/);
  assert.throws(() => requireCompleteMysqlTestReport('TAP version 13\n'), /missing the tests summary/);
});

test('MySQL gate CLI exits with failure before connecting when MYSQL_TEST_URL is missing', () => {
  const env = { ...process.env };
  delete env.MYSQL_TEST_URL;
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./run-mysql-integration-tests.mjs', import.meta.url))], {
    env,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /MYSQL_TEST_URL is required/);
  assert.equal(result.stdout, '');
});
