import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  buildJsapiPaySigningMessage,
  buildWechatPayPlatformHeaders,
  buildWechatPayResponseSigningMessage,
  buildWechatPaySigningMessage,
  createOutTradeNo,
  inspectWechatPayConfiguration,
  type WechatPayConfigurationInput,
} from './wechat-pay.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
  publicKeyEncoding: { format: 'pem', type: 'spki' },
});

function createValidConfiguration(): WechatPayConfigurationInput {
  return {
    appId: 'wx06f0bff0bed0dc80',
    mchId: '1234567890',
    serialNo: '0123456789ABCDEF0123456789ABCDEF01234567',
    privateKeyBase64: privateKey,
    apiV3Key: '0123456789abcdef0123456789abcdef',
    notifyUrl: 'https://example.com/api/shop/orders/notify',
    payPublicKey: publicKey,
    payPublicKeyId: 'PUB_KEY_ID_0123456789ABCDEF',
  };
}

test('accepts a complete RSA2048 public-key-mode configuration', () => {
  assert.deepEqual(inspectWechatPayConfiguration(createValidConfiguration()), {
    ready: true,
    keyMode: 'public-key',
    issues: [],
  });
});

test('reports invalid payment configuration without returning secret values', () => {
  const configuration = createValidConfiguration();
  configuration.appId = 'invalid-app-id';
  configuration.apiV3Key = 'too-short';
  configuration.notifyUrl = 'http://example.com/notify';
  configuration.privateKeyBase64 = 'not-a-private-key';

  const status = inspectWechatPayConfiguration(configuration);

  assert.equal(status.ready, false);
  assert.ok(status.issues.includes('WECHAT_APP_ID:invalid'));
  assert.ok(status.issues.includes('WECHAT_PAY_API_KEY_V3:invalid_length'));
  assert.ok(status.issues.includes('WECHAT_PAY_NOTIFY_URL:invalid'));
  assert.ok(status.issues.includes('WECHAT_PAY_PRIVATE_KEY:invalid'));
  assert.equal(JSON.stringify(status).includes('too-short'), false);
});

test('sends Wechatpay-Serial for a valid WeChat Pay public key or platform certificate', () => {
  assert.deepEqual(buildWechatPayPlatformHeaders('PUB_KEY_ID_0123456789ABCDEF'), {
    'Wechatpay-Serial': 'PUB_KEY_ID_0123456789ABCDEF',
  });
  assert.deepEqual(buildWechatPayPlatformHeaders('0123456789ABCDEF0123456789ABCDEF01234567'), {
    'Wechatpay-Serial': '0123456789ABCDEF0123456789ABCDEF01234567',
  });
  assert.deepEqual(buildWechatPayPlatformHeaders('PUB_KEY_ID_'), {});
});

test('builds the APIv3 signature message with the required trailing newline', () => {
  assert.equal(
    buildWechatPaySigningMessage('POST', '/v3/pay/transactions/jsapi', '1710000000', 'nonce', '{"amount":1}'),
    'POST\n/v3/pay/transactions/jsapi\n1710000000\nnonce\n{"amount":1}\n',
  );
  assert.equal(
    buildWechatPayResponseSigningMessage('1710000000', 'nonce', '{"prepay_id":"wx123"}'),
    '1710000000\nnonce\n{"prepay_id":"wx123"}\n',
  );
  assert.equal(
    buildJsapiPaySigningMessage('wx06f0bff0bed0dc80', '1710000000', 'nonce', 'prepay_id=wx123'),
    'wx06f0bff0bed0dc80\n1710000000\nnonce\nprepay_id=wx123\n',
  );
});

test('creates a stable 32-character out_trade_no for an idempotent client request', () => {
  const first = createOutTradeNo('openid-1', 'shop-request-1');
  const second = createOutTradeNo('openid-1', 'shop-request-1');

  assert.equal(first, second);
  assert.match(first, /^WH[A-F0-9]{30}$/);
  assert.notEqual(first, createOutTradeNo('openid-1', 'shop-request-2'));
  assert.match(createOutTradeNo('openid-1', 'activity-request-1', 'WA'), /^WA[A-F0-9]{30}$/);
});
