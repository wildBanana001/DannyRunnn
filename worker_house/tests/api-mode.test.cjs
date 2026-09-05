const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isProductionWeappBuild,
  resolveBuildApiMode,
} = require('../config/api-mode.ts');

test('开发构建缺省为 mock，并允许显式 mock', () => {
  assert.equal(resolveBuildApiMode(undefined, { isProductionWeapp: false }), 'mock');
  assert.equal(resolveBuildApiMode('mock', { isProductionWeapp: false }), 'mock');
});

test('正式微信小程序构建必须显式使用远端 API 模式', () => {
  assert.throws(
    () => resolveBuildApiMode(undefined, { isProductionWeapp: true }),
    /必须显式设置 TARO_APP_API_MODE/,
  );
  assert.throws(
    () => resolveBuildApiMode('mock', { isProductionWeapp: true }),
    /禁止使用 TARO_APP_API_MODE=mock/,
  );
  assert.equal(resolveBuildApiMode('cloudrun', { isProductionWeapp: true }), 'cloudrun');
  assert.equal(resolveBuildApiMode('bff', { isProductionWeapp: true }), 'bff');
});

test('非法 API 模式会立即终止构建', () => {
  assert.throws(
    () => resolveBuildApiMode('production', { isProductionWeapp: false }),
    /不支持的 TARO_APP_API_MODE=production/,
  );
});

test('仅 production weapp 被识别为正式微信小程序构建', () => {
  assert.equal(isProductionWeappBuild('weapp', 'production'), true);
  assert.equal(isProductionWeappBuild('weapp', 'development'), false);
  assert.equal(isProductionWeappBuild('h5', 'production'), false);
});
