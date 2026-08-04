import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWechatSelfPickupShippingPayload, truncateUtf8 } from './wechat-order-shipping.js';

test('builds a user self-pickup shipping payload for WeChat order management', () => {
  const uploadTime = '2026-08-03T10:20:30.000Z';
  const payload = buildWechatSelfPickupShippingPayload({
    id: 'WH0123456789ABCDEF0123456789ABCD',
    openid: 'openid-test',
    productName: '薄荷青柠莫吉托',
    quantity: 2,
  }, uploadTime, '1900000109');

  assert.deepEqual(payload, {
    order_key: {
      order_number_type: 1,
      mchid: '1900000109',
      out_trade_no: 'WH0123456789ABCDEF0123456789ABCD',
    },
    logistics_type: 4,
    delivery_mode: 1,
    shipping_list: [{ item_desc: '薄荷青柠莫吉托 x2' }],
    upload_time: uploadTime,
    payer: { openid: 'openid-test' },
  });
});

test('reports an onsite activity as user self-pickup only after check-in', () => {
  const uploadTime = '2026-08-04T12:00:00.000Z';
  const payload = buildWechatSelfPickupShippingPayload({
    id: 'WA0123456789ABCDEF0123456789ABCD',
    kind: 'activity',
    openid: 'openid-activity-test',
    productName: '周末社交派对',
    quantity: 1,
  }, uploadTime, '1900000109');

  assert.equal(payload.logistics_type, 4);
  assert.equal(payload.delivery_mode, 1);
  assert.equal(payload.order_key.out_trade_no, 'WA0123456789ABCDEF0123456789ABCD');
  assert.deepEqual(payload.shipping_list, [{ item_desc: '活动报名｜周末社交派对 x1' }]);
  assert.deepEqual(payload.payer, { openid: 'openid-activity-test' });
});

test('truncates item descriptions at a UTF-8 byte boundary', () => {
  const result = truncateUtf8('一'.repeat(50), 120);
  assert.equal(Buffer.byteLength(result, 'utf8'), 120);
  assert.equal(result, '一'.repeat(40));
});
