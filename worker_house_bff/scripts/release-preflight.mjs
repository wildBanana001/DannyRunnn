import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseReleaseTarget(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Set BFF_BASE_URL to the confirmed BFF HTTP origin.');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('BFF_BASE_URL must be an HTTPS origin without credentials, path, query or fragment (HTTP loopback is allowed).');
  }
  return url.origin;
}

export async function checkRelease({ baseUrl, expectShop = 'closed', expectTestPrices = false, fetchImpl = fetch }) {
  const origin = parseReleaseTarget(baseUrl);
  if (!['closed', 'open'].includes(expectShop)) throw new Error('Use --expect-shop=closed or --expect-shop=open.');
  const checks = [];
  const warnings = [];
  async function inspect(path, validate) {
    try {
      // No auth headers, follow-up redirects, payment calls, or configuration mutations.
      // Server-side auto-migration/initialization may still write to its database.
      const response = await fetchImpl(`${origin}${path}`, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { Accept: 'application/json' },
      });
      const body = await response.json();
      const issue = validate(response.status, body);
      checks.push({ path, passed: !issue, detail: issue || 'ok' });
    } catch {
      checks.push({ path, passed: false, detail: 'Request failed, timed out, redirected, or returned invalid JSON; check access and service logs.' });
    }
  }
  await inspect('/health', (status, body) => status === 200 && body?.status === 'ok' ? '' : 'Liveness failed.');
  await inspect('/api/health', (status, body) => {
    if (status !== 503 || body?.status !== 'configuration_required'
      || body?.mode !== 'cloudrun' || body?.persistence !== 'mysql-orders+catalogs'
      || body?.shop?.orderStorage !== 'mysql') {
      return 'Expected CloudRun + MySQL catalogs/orders with the legacy filesystem gate closed (HTTP 503 is expected here).';
    }
    return body.shop.enabled === (expectShop === 'open') ? '' : `Expected shop ${expectShop}; check the runtime switch.`;
  });
  await inspect('/api/shop/readiness', (status, body) => status === 200 && body?.ready === true
    && body?.mode === 'cloudrun' && body?.orderStorage?.type === 'mysql'
    && body?.orderStorage?.ready === true && body?.payment?.ready === true
    && body?.orderShipping?.ready === true ? '' : 'MySQL, payment configuration, or fulfillment configuration is not ready.');
  await inspect('/api/site-config', (status, body) => status === 200
    && typeof body?.communityWallEnabled === 'boolean' ? '' : 'Site capability configuration is unavailable or invalid.');
  for (const path of ['/api/activities?pageSize=100', '/api/shop/products']) {
    await inspect(path, (status, body) => {
      if (status !== 200 || !Array.isArray(body?.list) || !Number.isSafeInteger(body?.total)
        || body.total < body.list.length) return 'Catalog endpoint is unavailable or has an invalid envelope.';
      if (body.list.some((item) => !item || typeof item.id !== 'string' || !item.id.trim() || item.enabled !== true)) {
        return 'Public catalog contains an invalid or disabled record.';
      }
      if (expectTestPrices && body.list.some((item) => item.price !== 0.01)) {
        return 'Expected every returned public record to have a ¥0.01 unit price; database pricing has not been fully verified.';
      }
      if (body.list.length === 0) warnings.push(`${path}: empty catalog; confirm this is intentional.`);
      if (!expectTestPrices && body.list.some((item) => item.price === 0.01)) warnings.push(`${path}: contains ¥0.01 pricing; confirm test versus live pricing.`);
      if (path === '/api/shop/products' && body.list.some((item) => item.stock === null)) warnings.push('Products include unlimited inventory; confirm the intended stock policy.');
      return '';
    });
  }
  return {
    passed: checks.every((check) => check.passed), expectShop, expectedUnitPrice: expectTestPrices ? 0.01 : null, checks, warnings,
    scope: 'No orders or configuration changes requested. GET handlers may initialize/migrate storage. This is not payment settlement, full catalog reconciliation, or release approval.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--expect-test-prices' && !/^--expect-shop=(closed|open)$/.test(arg))
      || args.filter((arg) => arg.startsWith('--expect-shop=')).length > 1
      || args.filter((arg) => arg === '--expect-test-prices').length > 1) {
      throw new Error('Usage: BFF_BASE_URL=https://confirmed-host npm run check:release -- --expect-shop=closed|open [--expect-test-prices]');
    }
    const report = await checkRelease({
      baseUrl: process.env.BFF_BASE_URL,
      expectShop: args.find((arg) => arg.startsWith('--expect-shop='))?.split('=')[1] || 'closed',
      expectTestPrices: args.includes('--expect-test-prices'),
    });
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Release check failed.');
    process.exitCode = 1;
  }
}
