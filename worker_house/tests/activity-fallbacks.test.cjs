const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const readSource = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('活动与海报页面不再回退本地业务数据', () => {
  const home = readSource('src/pages/home/index.tsx');
  const originDetail = readSource('src/pages/content/origin-detail/index.tsx');
  const posterDetail = readSource('src/pages/poster-detail/index.tsx');

  assert.doesNotMatch(home, /getLocalActivitiesByStatus|@\/data\/activities/);
  assert.doesNotMatch(originDetail, /getLocalActivitiesByStatus|@\/data\/activities|@\/data\/posters/);
  assert.doesNotMatch(posterDetail, /@\/data\/posters|posters\s*\[/);
  assert.match(home, /Promise\.allSettled/);
  assert.match(originDetail, /Promise\.allSettled/);
});

test('活动图片不再按 act-002 注入本地封面或图库', () => {
  const services = readSource('src/cloud/services.ts');
  const activityDetail = readSource('src/pages/content/activity-detail/index.tsx');

  assert.doesNotMatch(services, /localActivityCoverImages|activity-asset:\/\/|'act-002'/);
  assert.doesNotMatch(activityDetail, /withLocalActivityDetailAssets|activity-assets/);
  assert.equal(fs.existsSync(path.join(projectRoot, 'src/pages/content/activity-detail/activity-assets.ts')), false);
});

test('活动图片业务兜底不再使用带具体排期的 hero-may', () => {
  const home = readSource('src/pages/home/index.tsx');
  const activityPage = readSource('src/pages/activity/index.tsx');

  assert.doesNotMatch(home, /hero-may\.jpg/);
  assert.doesNotMatch(activityPage, /hero-may\.jpg/);
  assert.match(home, /space-room-v2\.jpg/);
  assert.match(activityPage, /space-room-v2\.jpg/);
});

test('一分钱价格按真实 price 展示，不再隐式解释为体验支付', () => {
  const activityCard = readSource('src/components/ActivityCard/index.tsx');
  const activityDetail = readSource('src/pages/content/activity-detail/index.tsx');

  assert.doesNotMatch(activityCard, /isTestPaymentPrice|体验支付|displayPrice/);
  assert.doesNotMatch(activityDetail, /isTestPaymentPrice|体验支付|displayPrice/);
  assert.match(activityCard, /formatPrice\(activity\.price\)/);
  assert.match(activityDetail, /formatPrice\(activity\.price\)/);
});

test('CloudRun 公开运行参数由构建环境注入，不在业务源码写死', () => {
  const runtime = readSource('src/constants/runtime.ts');
  const request = readSource('src/services/request.ts');
  const config = readSource('config/index.ts');

  assert.doesNotMatch(runtime, /prod-d9g991lo4dba5a4da|worker-house-bff|PAYMENT_API_MODE/);
  assert.match(runtime, /TARO_APP_CLOUD_ENV_ID/);
  assert.match(runtime, /TARO_APP_CLOUDRUN_SERVICE/);
  assert.match(request, /process\.env\.TARO_ENV === 'weapp' \? getApiMode\(\) : 'mock'/);
  assert.match(config, /CloudRun 构建必须配置/);
});
