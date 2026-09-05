const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(projectRoot, 'src');
const readSource = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

const listSourceFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolutePath = path.join(directory, entry.name);
  if (entry.isDirectory()) {
    return listSourceFiles(absolutePath);
  }
  return /\.(?:ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
});

test('用户、认证和管理员 mock fixture 仅由构建期隔离的数据适配层引用', () => {
  const auth = readSource('src/services/auth.ts');
  const admin = readSource('src/services/adminFulfillment.ts');
  const cloud = readSource('src/cloud/services.ts');
  const post = readSource('src/services/post.ts');

  assert.match(auth, /from ['"]@\/data\/mock-member['"]/);
  assert.match(admin, /from ['"]@\/data\/mock-member['"]/);
  assert.match(cloud, /getMockCurrentUser/);
  assert.match(post, /getMockCurrentUser/);
  assert.doesNotMatch(auth, /@tarojs\/taro|mock_openid|worker-house-mock-wx-user|体验用户/);
  assert.doesNotMatch(admin, /@tarojs\/taro|mock_openid|WA-MOCK-|WH-MOCK-|mockTasks|13800000000/);

  const directFixtureImports = listSourceFiles(sourceRoot)
    .filter((file) => /from ['"]@\/data\/(?:users|site)['"]/.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(projectRoot, file).split(path.sep).join('/'));
  assert.deepEqual(directFixtureImports, ['src/data/mock-member.ts']);
});

test('生产 remote-safe 适配层覆盖新增接口且不含身份、订单或站点业务种子', () => {
  const stub = readSource('src/data/remote-safe/mock-member.ts');
  const requiredExports = [
    'getMockWxLoginResult',
    'getMockWxUserProfile',
    'updateMockWxUserProfile',
    'getMockAdminIdentity',
    'getMockAdminFulfillmentTasks',
    'completeMockAdminFulfillmentTask',
    'getMockSiteConfigRecord',
    'getMockLegacySiteConfig',
    'getMockCurrentUser',
    'getMockLoginPreset',
  ];

  requiredExports.forEach((name) => assert.match(stub, new RegExp(`export const ${name}\\b`)));
  assert.doesNotMatch(
    stub,
    /mock_openid|WA-MOCK-|WH-MOCK-|DannyRunnn|香蕉|凯锋|体验用户|13800000000|sph_worker_house_demo/,
  );
  assert.match(stub, /getMockAdminIdentity = \(\): AdminIdentity => \(\{ isAdmin: false, openid: '' \}\)/);
  assert.match(stub, /getMockAdminFulfillmentTasks = \(\): AdminFulfillmentTask\[\] => \[\]/);
  assert.match(stub, /homeOwners: \[\]/);
  assert.match(stub, /contactWechat: ''/);
});

test('非 mock 站点配置失败向上传递并由 hooks 收敛到安全空态', () => {
  const service = readSource('src/services/siteConfig.ts');
  const shared = readSource('src/shared/siteConfig.ts');
  const home = readSource('src/pages/home/index.tsx');
  const settings = readSource('src/pages/settings/index.tsx');

  assert.match(service, /const apiMode = getApiMode\(\)/);
  assert.doesNotMatch(service, /getPaymentApiMode/);
  assert.match(service, /if \(apiMode === 'mock'\) \{\s*return getMockSiteConfigRecord\(\);\s*\}/);
  assert.doesNotMatch(service, /catch\s*\(|catch\s*\{|DannyRunnn|sph_worker_house_demo|owner-orange|owner-cat/);
  assert.match(service, /export const emptySiteConfigRecord/);
  assert.match(service, /homeOwners: \[\]/);
  assert.match(service, /contactWechat: ''/);

  assert.doesNotMatch(shared, /getStorageSync|setStorageSync|defaultSiteConfigRecord/);
  assert.match(shared, /setConfig\(emptySiteConfigRecord\)/);
  assert.match(shared, /removeStorageSync\('worker-house-site-config'\)/);

  assert.doesNotMatch(home, /@\/data\/site|homeLandingConfig|FALLBACK_OWNER_CARDS|communityQrFallback/);
  assert.doesNotMatch(settings, /@\/data\/site|siteConfig\.spaceDescription/);
});

test('起源页只消费远端站点结果，失败时不合并本地站点业务数据', () => {
  const origin = readSource('src/pages/content/origin-detail/index.tsx');

  assert.match(origin, /Promise\.allSettled\(\[fetchPosterList\(\), fetchSiteConfig\(\), fetchActivities\('ongoing'\)\]\)/);
  assert.match(origin, /siteResult\.status === 'fulfilled' \? siteResult\.value : null/);
  assert.doesNotMatch(origin, /@\/data\/site|homeLandingConfig|siteFallback|FALLBACK_SITE_CONFIG|mergeSiteConfig|siteConfig\.originParagraphs/);
  assert.match(origin, /spaceDescription/);
  assert.match(origin, /起源内容暂不可用/);
});

test('显式 mock 构建仍保留完整本地开发 fixture', () => {
  const mockAdapter = readSource('src/data/mock-member.ts');
  const config = readSource('config/index.ts');

  assert.match(config, /apiMode === 'mock'\s*\? \{\}/);
  assert.match(mockAdapter, /getMockWxLoginResult/);
  assert.match(mockAdapter, /getMockAdminFulfillmentTasks/);
  assert.match(mockAdapter, /getMockSiteConfigRecord/);
  assert.match(mockAdapter, /getMockCurrentUser/);
  assert.match(mockAdapter, /WA-MOCK-ACTIVITY-001/);
  assert.match(mockAdapter, /worker-house-mock-wx-user/);
});
