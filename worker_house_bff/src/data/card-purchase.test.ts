import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCardPurchaseRequest, resolveActiveCardPackageTerms } from './card-purchase.js';
import type { CardPackage } from '../types/index.js';

const activePackage: CardPackage = {
  id: 'card-package-3x',
  name: '社畜次卡 3 次装',
  totalCount: 3,
  price: 399,
  perUseMaxOffset: 148,
  validDays: 180,
  status: 'active',
  sortOrder: 1,
  createdAt: '2026-04-26T15:00:00.000Z',
  updatedAt: '2026-04-26T15:00:00.000Z',
};

test('card purchase request accepts only a package id', () => {
  assert.deepEqual(parseCardPurchaseRequest({ packageId: ' card-package-3x ' }), {
    packageId: 'card-package-3x',
  });

  for (const untrustedField of [
    'amount',
    'cardType',
    'expiresAt',
    'perUseMaxOffset',
    'profileId',
    'totalCount',
    'userNickname',
    'userWechatName',
    'validDays',
  ]) {
    assert.throws(
      () => parseCardPurchaseRequest({ packageId: activePackage.id, [untrustedField]: 1 }),
      /只允许 packageId/,
    );
  }

  assert.throws(() => parseCardPurchaseRequest({}), /缺少有效的次卡套餐 ID/);
  assert.throws(() => parseCardPurchaseRequest(null), /只允许 packageId/);
});

test('card entitlement terms come only from the active server package', () => {
  assert.deepEqual(resolveActiveCardPackageTerms(activePackage), {
    amount: 399,
    cardType: '社畜次卡 3 次装',
    packageId: 'card-package-3x',
    perUseMaxOffset: 148,
    totalCount: 3,
    validDays: 180,
  });
});

test('archived or malformed packages fail closed', () => {
  assert.throws(
    () => resolveActiveCardPackageTerms({ ...activePackage, status: 'archived' }),
    /不存在或已下架/,
  );
  assert.throws(
    () => resolveActiveCardPackageTerms({ ...activePackage, totalCount: 0 }),
    /配置异常/,
  );
  assert.throws(() => resolveActiveCardPackageTerms(null), /不存在或已下架/);
});
