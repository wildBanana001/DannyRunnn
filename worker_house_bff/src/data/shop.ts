import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import {
  getMysqlProductById,
  initializeMysqlProductCatalog,
  listMysqlProducts,
} from './mysql-catalogs.js';

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
  shippingFee: number;
  minQuantity: number;
  maxQuantity: number;
  stock: number | null;
  enabled: boolean;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
// 构建时复制到 dist/data；生产仅用于首次 MySQL seed，本地 file/mock 模式直接读取。
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

function parseRequiredCurrency(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const cents = value * 100;
  const roundedCents = Math.round(cents);
  return Number.isSafeInteger(roundedCents) && Math.abs(cents - roundedCents) < 1e-8
    ? value
    : null;
}

function parseRequiredFulfillmentType(value: unknown): ShopFulfillmentType | null {
  return value === 'delivery' || value === 'onsite' || value === 'pickup' ? value : null;
}

function parseRequiredQuantity(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 99
    ? value
    : null;
}

function parseRequiredStock(value: unknown): { valid: boolean; value: number | null } {
  if (value === null) return { valid: true, value: null };
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return { valid: true, value };
  }
  return { valid: false, value: 0 };
}

export function normalizeShopProduct(item: Partial<ShopProduct>): ShopProduct {
  const fulfillmentTypeInput = parseRequiredFulfillmentType(item.fulfillmentType);
  const fulfillmentType = fulfillmentTypeInput ?? 'delivery';
  const fulfillmentLabel = sanitizeString(item.fulfillmentLabel);
  const unitLabel = sanitizeString(item.unitLabel);
  const id = sanitizeString(item.id);
  const name = sanitizeString(item.name);
  const priceInput = parseRequiredCurrency(item.price);
  const shippingFeeInput = parseRequiredCurrency(item.shippingFee);
  const minQuantityInput = parseRequiredQuantity(item.minQuantity);
  const maxQuantityInput = parseRequiredQuantity(item.maxQuantity);
  const quantityConfigurationValid = minQuantityInput !== null
    && maxQuantityInput !== null
    && maxQuantityInput >= minQuantityInput;
  const minQuantity = minQuantityInput ?? 1;
  const maxQuantity = minQuantityInput !== null
    && maxQuantityInput !== null
    && maxQuantityInput >= minQuantityInput
    ? maxQuantityInput
    : minQuantity;
  const stockInput = parseRequiredStock(item.stock);
  const price = priceInput ?? 0;
  const originalPriceInput = parseRequiredCurrency(item.originalPrice);
  const catalogConfigurationValid = Boolean(id)
    && Boolean(name)
    && priceInput !== null
    && shippingFeeInput !== null
    && quantityConfigurationValid
    && stockInput.valid
    && fulfillmentTypeInput !== null
    && Boolean(fulfillmentLabel)
    && Boolean(unitLabel);

  return {
    id,
    name,
    price,
    originalPrice: originalPriceInput ?? price,
    imageUrl: sanitizeString(item.imageUrl),
    description: sanitizeString(item.description),
    tags: Array.isArray(item.tags) ? item.tags.map((tag) => sanitizeString(tag)).filter(Boolean) : [],
    category: sanitizeString(item.category) || '周边',
    fulfillmentType,
    fulfillmentLabel,
    unitLabel,
    alcoholic: typeof item.alcoholic === 'boolean' ? item.alcoholic : false,
    abv: Math.max(0, sanitizeNumber(item.abv)),
    volumeMl: Math.max(0, sanitizeNumber(item.volumeMl)),
    shippingFee: shippingFeeInput ?? 0,
    minQuantity,
    maxQuantity,
    stock: stockInput.value,
    enabled: item.enabled === true && catalogConfigurationValid,
  };
}

function readBundledProducts() {
  const rawContent = readFileSync(storageFilePath, 'utf-8');
  const parsed = JSON.parse(rawContent) as ShopProduct[];
  if (!Array.isArray(parsed)) throw new Error('商城商品目录必须是数组');

  const products = parsed.map((item) => normalizeShopProduct(item));
  const invalidProduct = products.find((item) => !item.id || !item.name || item.price < 0 || item.originalPrice < 0);
  if (invalidProduct) throw new Error(`商品字段不完整：id=${invalidProduct.id || '<empty>'}`);
  const productIds = new Set(products.map((item) => item.id));
  if (productIds.size !== products.length) throw new Error('商品 ID 不能重复');
  return products;
}

function loadProducts() {
  if (store.loaded) {
    return;
  }

  if (config.shopOrderStorage === 'mysql') {
    throw new Error('MySQL 商品目录尚未初始化');
  }

  store.loaded = true;

  try {
    store.products = readBundledProducts();
  } catch (error) {
    console.error('[shop store] load error', error);
    // 目录损坏时安全失败，不使用隐藏在代码中的过期商品或价格。
    store.products = [];
  }
}

export async function initializeShopCatalog() {
  if (config.shopOrderStorage !== 'mysql') {
    loadProducts();
    return listProducts();
  }
  const seedProducts = readBundledProducts();
  store.products = (await initializeMysqlProductCatalog(seedProducts)).map(normalizeShopProduct);
  store.loaded = true;
  return listProducts();
}

export async function listPersistedProducts() {
  if (config.shopOrderStorage !== 'mysql') return listProducts();
  store.products = (await listMysqlProducts()).map(normalizeShopProduct);
  store.loaded = true;
  return listProducts();
}

export async function getPersistedProductById(productId: string) {
  if (config.shopOrderStorage !== 'mysql') return getProductById(productId);
  const record = await getMysqlProductById(productId);
  if (!record) {
    store.products = store.products.filter((item) => item.id !== productId);
    return null;
  }
  const normalized = normalizeShopProduct(record);
  const exists = store.products.some((item) => item.id === productId);
  store.products = exists
    ? store.products.map((item) => item.id === productId ? normalized : item)
    : [...store.products, normalized];
  store.loaded = true;
  return clone(normalized);
}

export function getShopProductQuantityIssue(product: ShopProduct, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < product.minQuantity || quantity > product.maxQuantity) {
    return `购买数量需在 ${product.minQuantity}-${product.maxQuantity} 之间`;
  }
  if (product.stock !== null && quantity > product.stock) return '商品库存不足';
  return '';
}

export function calculateShopOrderPricing(product: ShopProduct, quantity: number) {
  const unitPrice = Math.round(product.price * 100);
  const shippingFee = Math.round(product.shippingFee * 100);
  const amount = unitPrice * quantity + shippingFee;
  if (![unitPrice, shippingFee, amount].every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error('订单金额异常');
  }
  return { amount, shippingFee, unitPrice };
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
