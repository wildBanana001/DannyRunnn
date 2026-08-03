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

test('exposes a useful MySQL error while redacting credential values', () => {
  const failure = buildPaymentFailureResponse(
    Object.assign(new Error('database request failed secretKey=very-sensitive-value'), {
      code: 'DATABASE_REQUEST_FAILED',
    }),
    { fallbackMessage: '支付订单创建失败', operation: 'shop_create', stage: 'order_lookup' },
  );

  assert.equal(failure.status, 500);
  assert.equal(failure.payload.diagnostic.source, 'mysql');
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

test('reports reset MySQL connections as a retryable service outage', () => {
  const failure = buildPaymentFailureResponse(
    Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
    { fallbackMessage: '活动报名支付单创建失败', operation: 'activity_create', stage: 'order_lookup' },
  );

  assert.equal(failure.status, 503);
  assert.equal(failure.payload.diagnostic.status, 503);
  assert.equal(failure.payload.diagnostic.code, 'ECONNRESET');
  assert.equal(failure.payload.diagnostic.source, 'mysql');
  assert.match(failure.payload.diagnostic.detail, /连接被临时中断/);
  assert.doesNotMatch(failure.payload.message, /read ECONNRESET/);
});

test('translates missing MySQL configuration into an actionable configuration error', () => {
  const failure = buildPaymentFailureResponse(
    Object.assign(new Error('MySQL 订单库配置不完整：MYSQL_ADDRESS、MYSQL_PASSWORD'), {
      code: 'MYSQL_CONFIGURATION_REQUIRED',
    }),
    { fallbackMessage: '支付订单创建失败', operation: 'shop_create', stage: 'order_lookup' },
  );

  assert.equal(failure.status, 503);
  assert.equal(failure.payload.diagnostic.status, 503);
  assert.equal(failure.payload.diagnostic.code, 'MYSQL_CONFIGURATION_REQUIRED');
  assert.equal(failure.payload.diagnostic.source, 'mysql');
  assert.match(failure.payload.diagnostic.detail, /MYSQL_ADDRESS/);
  assert.match(failure.payload.message, /MYSQL_PASSWORD/);
});

test('redacts MySQL passwords embedded in connection URIs', () => {
  const failure = buildPaymentFailureResponse(
    new Error('connect failed mysql://worker:super-secret@10.0.0.8:3306/worker_house'),
    { fallbackMessage: '支付订单创建失败', operation: 'shop_create', stage: 'order_lookup' },
  );

  assert.doesNotMatch(failure.payload.message, /super-secret/);
  assert.match(failure.payload.message, /REDACTED_CONNECTION/);
});
