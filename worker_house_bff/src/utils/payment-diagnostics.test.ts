import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPaymentFailureResponse } from './payment-diagnostics.js';
import { WechatPayApiError } from './wechat-pay.js';

test('returns WeChat Pay code, request id, stage and trace id to the client', () => {
  const failure = buildPaymentFailureResponse(
    new WechatPayApiError('商户号与 AppID 不匹配', {
      code: 'APPID_MCHID_NOT_MATCH',
      requestId: 'wechat-request-123',
      status: 400,
    }),
    { fallbackMessage: '支付订单创建失败', operation: 'shop_create', stage: 'payment_preparation' },
  );

  assert.equal(failure.status, 502);
  assert.equal(failure.payload.diagnostic.status, 400);
  assert.equal(failure.payload.diagnostic.code, 'APPID_MCHID_NOT_MATCH');
  assert.equal(failure.payload.diagnostic.requestId, 'wechat-request-123');
  assert.equal(failure.payload.diagnostic.stage, 'payment_preparation');
  assert.match(failure.payload.diagnostic.diagnosticId, /^PAY-[A-F0-9]{10}$/);
  assert.match(failure.payload.message, /商户号与 AppID 不匹配/);
});

test('exposes a useful CloudBase error while redacting credential values', () => {
  const failure = buildPaymentFailureResponse(
    Object.assign(new Error('database request failed secretKey=very-sensitive-value'), {
      code: 'DATABASE_REQUEST_FAILED',
    }),
    { fallbackMessage: '支付订单创建失败', operation: 'shop_create', stage: 'order_lookup' },
  );

  assert.equal(failure.status, 500);
  assert.equal(failure.payload.diagnostic.source, 'cloudbase');
  assert.equal(failure.payload.diagnostic.code, 'DATABASE_REQUEST_FAILED');
  assert.match(failure.payload.diagnostic.detail, /secretKey=\[REDACTED\]/);
  assert.doesNotMatch(failure.payload.message, /very-sensitive-value/);
});

test('assigns a stable diagnostic code to generic network failures', () => {
  const failure = buildPaymentFailureResponse(
    new Error('fetch failed'),
    { fallbackMessage: '支付订单创建失败', operation: 'shop_create', stage: 'order_lookup' },
  );

  assert.equal(failure.payload.diagnostic.code, 'NETWORK_FETCH_FAILED');
  assert.match(failure.payload.message, /stage=order_lookup/);
});
