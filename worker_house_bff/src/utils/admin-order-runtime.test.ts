import assert from 'node:assert/strict';
import test from 'node:test';
import { isMysqlBackedAdminOrderRequest } from './admin-order-runtime.js';

test('allows MySQL-backed registration and fulfillment requests', () => {
  assert.equal(isMysqlBackedAdminOrderRequest('/admin-mini/registrations', 'GET'), true);
  assert.equal(isMysqlBackedAdminOrderRequest('/admin-mini/registrations/WA-001', 'GET'), true);
  assert.equal(isMysqlBackedAdminOrderRequest('/admin-mini/fulfillment-tasks', 'GET'), true);
  assert.equal(
    isMysqlBackedAdminOrderRequest('/admin-mini/fulfillment-tasks/shop/WH-001/complete', 'POST'),
    true,
  );
  assert.equal(
    isMysqlBackedAdminOrderRequest('/admin-mini/fulfillment-tasks/activity/WA-001/complete', 'POST'),
    true,
  );
});

test('does not broaden the production gate to unrelated admin requests', () => {
  assert.equal(isMysqlBackedAdminOrderRequest('/admin-mini/fulfillment-tasks', 'POST'), false);
  assert.equal(
    isMysqlBackedAdminOrderRequest('/admin-mini/fulfillment-tasks/delivery/WH-001/complete', 'POST'),
    false,
  );
  assert.equal(
    isMysqlBackedAdminOrderRequest('/admin-mini/fulfillment-tasks/shop/WH-001/complete/again', 'POST'),
    false,
  );
  assert.equal(isMysqlBackedAdminOrderRequest('/admin-mini/orders', 'GET'), false);
  assert.equal(isMysqlBackedAdminOrderRequest('/admin-mini/registrations', 'DELETE'), false);
});
