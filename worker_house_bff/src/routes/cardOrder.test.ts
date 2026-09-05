import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { rejectCardPurchase } from './card-purchase-unavailable.js';
import { cardOrderRouter } from './cardOrder.js';

interface RouterLayer {
  route?: {
    methods?: Record<string, boolean>;
    path?: string;
    stack?: Array<{ handle?: unknown }>;
  };
}

test('card purchase endpoint fails closed without issuing an entitlement', () => {
  let statusCode = 0;
  let payload: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      payload = value;
      return this;
    },
  } as unknown as Response;

  rejectCardPurchase({} as Request, response, (() => undefined) as NextFunction);

  assert.equal(statusCode, 503);
  assert.deepEqual(payload, {
    code: 'CARD_PURCHASE_UNAVAILABLE',
    message: '次卡购买暂未开放',
  });
});

test('POST / is wired only to the fail-closed purchase handler', () => {
  const layers = (cardOrderRouter as unknown as { stack: RouterLayer[] }).stack;
  const postLayer = layers.find((layer) => (
    layer.route?.path === '/'
    && layer.route.methods?.post
  ));

  assert.ok(postLayer);
  assert.deepEqual(postLayer.route?.stack?.map((layer) => layer.handle), [rejectCardPurchase]);
});
