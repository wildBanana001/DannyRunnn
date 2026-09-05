const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const readSource = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('非 mock 构建为业务 mock 模块配置可生效的 alias', () => {
  const config = readSource('config/index.ts');

  assert.match(config, /apiMode === 'mock'\s*\? \{\}/);
  assert.match(config, /'@\/data\/activities\$'/);
  assert.match(config, /remote-safe\/activities\.ts/);
  assert.match(config, /'@\/data\/mock-member\$'/);
  assert.match(config, /remote-safe\/mock-member\.ts/);
  assert.match(config, /'@\/data\/posts\$'/);
  assert.match(config, /remote-safe\/posts\.ts/);
  assert.match(config, /'@\/data\/posters\$'/);
  assert.match(config, /remote-safe\/posters\.ts/);
  assert.match(config, /'@': resolve\(__dirname, '\.\.\/src'\)/);
  assert.doesNotMatch(config, /TsconfigPathsPlugin/);
  assert.equal(
    (config.match(/chain\.resolve\.alias\.merge\(sourceAliases\)/g) || []).length,
    2,
    'mini 与 h5 webpack 链都必须安装隔离 alias',
  );
});

test('alias 与生产源码中的 import specifier 精确对应', () => {
  const services = readSource('src/cloud/services.ts');
  const member = readSource('src/services/member.ts');

  assert.match(services, /from '@\/data\/activities'/);
  assert.match(services, /from '@\/data\/posters'/);
  assert.match(member, /from '@\/data\/mock-member'/);
});

test('remote-safe stub 不引用原始 mock 模块且不包含业务种子', () => {
  const activitiesStub = readSource('src/data/remote-safe/activities.ts');
  const memberStub = readSource('src/data/remote-safe/mock-member.ts');
  const postsStub = readSource('src/data/remote-safe/posts.ts');
  const postersStub = readSource('src/data/remote-safe/posters.ts');
  const combined = `${activitiesStub}\n${memberStub}\n${postsStub}\n${postersStub}`;

  assert.doesNotMatch(
    combined,
    /from ['"](?:@\/data\/(?:activities|mock-member|posts|posters)|\.\/?(?:activities|mock-member|posts|posters))['"]/,
  );
  assert.doesNotMatch(combined, /act-\d+|poster-\d+|mock_openid|凯锋|CARD_PACKAGE_PRICE|STORAGE_KEY/);
  assert.match(activitiesStub, /allActivities: Activity\[\] = \[\]/);
  assert.match(postersStub, /posters: Poster\[\] = \[\]/);
  assert.match(memberStub, /profiles: \[\]/);
  assert.match(memberStub, /registrations: \[\]/);
  assert.match(memberStub, /cardOrder: null/);
  assert.match(postsStub, /posts: Post\[\] = \[\]/);
  assert.match(postsStub, /comments: Comment\[\] = \[\]/);
});

test('CloudRun 环境校验和 define constants 在隔离改动后仍保留', () => {
  const config = readSource('config/index.ts');

  assert.match(config, /apiMode === 'cloudrun'/);
  assert.match(config, /CloudRun 构建必须配置 TARO_APP_CLOUD_ENV_ID 和 TARO_APP_CLOUDRUN_SERVICE/);
  assert.match(config, /'process\.env\.TARO_APP_API_MODE': JSON\.stringify\(apiMode\)/);
  assert.match(config, /'process\.env\.TARO_APP_CLOUD_ENV_ID': JSON\.stringify\(cloudEnvId\)/);
  assert.match(config, /'process\.env\.TARO_APP_CLOUDRUN_SERVICE': JSON\.stringify\(cloudrunService\)/);
});
