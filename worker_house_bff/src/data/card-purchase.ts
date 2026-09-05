import type { CardPackage } from '../types/index.js';

export interface CardPurchaseRequest {
  packageId: string;
}

export interface CardPurchaseTerms {
  amount: number;
  cardType: string;
  packageId: string;
  perUseMaxOffset: number;
  totalCount: number;
  validDays: number;
}

export function parseCardPurchaseRequest(value: unknown): CardPurchaseRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('次卡购买参数只允许 packageId');
  }

  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => key !== 'packageId')) {
    throw new Error('次卡购买参数只允许 packageId');
  }

  const packageId = typeof input.packageId === 'string' ? input.packageId.trim() : '';
  if (!packageId || packageId.length > 80) {
    throw new Error('缺少有效的次卡套餐 ID');
  }

  return { packageId };
}

export function resolveActiveCardPackageTerms(cardPackage: CardPackage | null): CardPurchaseTerms {
  if (!cardPackage || cardPackage.status !== 'active') {
    throw new Error('次卡套餐不存在或已下架');
  }
  if (
    !Number.isSafeInteger(cardPackage.totalCount)
    || cardPackage.totalCount <= 0
    || !Number.isFinite(cardPackage.price)
    || cardPackage.price < 0
    || !Number.isFinite(cardPackage.perUseMaxOffset)
    || cardPackage.perUseMaxOffset < 0
    || !Number.isSafeInteger(cardPackage.validDays)
    || cardPackage.validDays <= 0
  ) {
    throw new Error('次卡套餐配置异常');
  }

  return {
    amount: cardPackage.price,
    cardType: cardPackage.name,
    packageId: cardPackage.id,
    perUseMaxOffset: cardPackage.perUseMaxOffset,
    totalCount: cardPackage.totalCount,
    validDays: cardPackage.validDays,
  };
}
