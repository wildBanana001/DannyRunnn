import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ShopFulfillmentType = 'delivery' | 'onsite' | 'pickup';

export interface ShopProduct {
  id: string;
  name: string;
  price: number; // 售价，单位：元
  originalPrice: number; // 原价，单位：元
  imageUrl: string;
  description: string;
  tags: string[];
  category: string;
  fulfillmentType: ShopFulfillmentType;
  fulfillmentLabel: string;
  unitLabel: string;
  alcoholic: boolean;
  abv: number;
  volumeMl: number;
  enabled: boolean;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
// 单一商品目录：构建时原样复制到 dist/data，不再于 TypeScript 中维护重复商品。
const storageFilePath = path.join(currentDir, 'shop.store.json');

interface ShopStoreState {
  products: ShopProduct[];
  loaded: boolean;
}

const store: ShopStoreState = {
  loaded: false,
  products: [],
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sanitizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function sanitizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeFulfillmentType(value: unknown): ShopFulfillmentType {
  return value === 'onsite' || value === 'pickup' ? value : 'delivery';
}

function getDefaultFulfillmentLabel(type: ShopFulfillmentType) {
  if (type === 'onsite') return '到店享用';
  if (type === 'pickup') return '到店自取';
  return '快递配送';
}

export function normalizeShopProduct(item: Partial<ShopProduct>): ShopProduct {
  const fulfillmentType = sanitizeFulfillmentType(item.fulfillmentType);
  return {
    id: sanitizeString(item.id),
    name: sanitizeString(item.name),
    price: sanitizeNumber(item.price),
    originalPrice: sanitizeNumber(item.originalPrice),
    imageUrl: sanitizeString(item.imageUrl),
    description: sanitizeString(item.description),
    tags: Array.isArray(item.tags) ? item.tags.map((tag) => sanitizeString(tag)).filter(Boolean) : [],
    category: sanitizeString(item.category) || '周边',
    fulfillmentType,
    fulfillmentLabel: sanitizeString(item.fulfillmentLabel) || getDefaultFulfillmentLabel(fulfillmentType),
    unitLabel: sanitizeString(item.unitLabel) || '件',
    alcoholic: typeof item.alcoholic === 'boolean' ? item.alcoholic : false,
    abv: Math.max(0, sanitizeNumber(item.abv)),
    volumeMl: Math.max(0, sanitizeNumber(item.volumeMl)),
    enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
  };
}

function loadProducts() {
  if (store.loaded) {
    return;
  }

  store.loaded = true;

  try {
    const rawContent = readFileSync(storageFilePath, 'utf-8');
    const parsed = JSON.parse(rawContent) as ShopProduct[];
    if (!Array.isArray(parsed)) {
      throw new Error('商城商品目录必须是数组');
    }

    const products = parsed.map((item) => normalizeShopProduct(item));
    const invalidProduct = products.find((item) => !item.id || !item.name || item.price < 0 || item.originalPrice < 0);
    if (invalidProduct) {
      throw new Error(`商品字段不完整：id=${invalidProduct.id || '<empty>'}`);
    }

    const productIds = new Set(products.map((item) => item.id));
    if (productIds.size !== products.length) {
      throw new Error('商品 ID 不能重复');
    }

    store.products = products;
  } catch (error) {
    console.error('[shop store] load error', error);
    // 目录损坏时安全失败，不使用隐藏在代码中的过期商品或价格。
    store.products = [];
  }
}

export function listProducts(): ShopProduct[] {
  loadProducts();
  return clone(store.products.filter((item) => item.enabled));
}

export function getProductById(productId: string): ShopProduct | null {
  loadProducts();
  const record = store.products.find((item) => item.id === productId) ?? null;
  return record ? clone(record) : null;
}
