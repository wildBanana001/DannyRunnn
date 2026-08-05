import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const storageFilePath = path.join(currentDir, 'shop.store.json');

/**
 * 商城种子数据。当前仅上架瓶装饮用水；已下架商品继续保留，
 * 以便历史订单仍能展示完整的商品快照和履约信息。
 * 图片托管在 public/images/shop/ 下，通过 /static 路由对外访问。
 */
const DEFAULT_PRODUCTS: ShopProduct[] = [
  {
    id: 'bottled-water-550ml',
    name: '瓶装饮用水（550ml）',
    price: 1,
    originalPrice: 1,
    imageUrl: '/static/images/shop/product-water.jpg',
    description: '550ml 密封瓶装饮用水，支付成功后可在活动现场到店自取。',
    tags: ['饮用水', '550ml', '到店自取'],
    category: '饮品',
    fulfillmentType: 'pickup',
    fulfillmentLabel: '到店自取',
    unitLabel: '瓶',
    alcoholic: false,
    abv: 0,
    volumeMl: 550,
    enabled: true,
  },
  {
    id: 'cocktail-afterwork-sour',
    name: '下班快乐威士忌酸',
    price: 49,
    originalPrice: 49,
    imageUrl: '/static/images/shop/cocktail-afterwork-sour.jpg',
    description: '威士忌与新鲜柠檬的明亮酸甜，给忙碌一天一个轻松收尾。',
    tags: ['威士忌', '酸甜', '到店享用'],
    category: 'cocktail',
    fulfillmentType: 'onsite',
    fulfillmentLabel: '到店享用',
    unitLabel: '杯',
    alcoholic: true,
    abv: 14,
    volumeMl: 180,
    enabled: false,
  },
  {
    id: 'cocktail-mint-mojito',
    name: '薄荷青柠莫吉托',
    price: 45,
    originalPrice: 45,
    imageUrl: '/static/images/shop/cocktail-mint-mojito.jpg',
    description: '清新薄荷、青柠与气泡交织，入口轻盈，适合慢慢放松。',
    tags: ['朗姆酒', '清爽', '到店享用'],
    category: 'cocktail',
    fulfillmentType: 'onsite',
    fulfillmentLabel: '到店享用',
    unitLabel: '杯',
    alcoholic: true,
    abv: 10,
    volumeMl: 300,
    enabled: false,
  },
  {
    id: 'cocktail-berry-fizz',
    name: '莓果微醺气泡',
    price: 52,
    originalPrice: 52,
    imageUrl: '/static/images/shop/cocktail-berry-fizz.jpg',
    description: '酸甜莓果搭配细腻气泡，果香饱满，口感轻快。',
    tags: ['莓果', '气泡', '到店享用'],
    category: 'cocktail',
    fulfillmentType: 'onsite',
    fulfillmentLabel: '到店享用',
    unitLabel: '杯',
    alcoholic: true,
    abv: 8,
    volumeMl: 300,
    enabled: false,
  },
  {
    id: 'cocktail-sunset-highball',
    name: '落日柑橘嗨棒',
    price: 48,
    originalPrice: 48,
    imageUrl: '/static/images/shop/cocktail-sunset-highball.jpg',
    description: '清爽嗨棒融入柑橘香气，像落日一样明亮又温柔。',
    tags: ['嗨棒', '柑橘', '到店享用'],
    category: 'cocktail',
    fulfillmentType: 'onsite',
    fulfillmentLabel: '到店享用',
    unitLabel: '杯',
    alcoholic: true,
    abv: 9,
    volumeMl: 320,
    enabled: false,
  },
  {
    id: 'cocktail-espresso-martini',
    name: '浓缩咖啡马天尼',
    price: 56,
    originalPrice: 56,
    imageUrl: '/static/images/shop/cocktail-espresso-martini.jpg',
    description: '浓缩咖啡的醇苦与酒香平衡，绵密泡沫带来顺滑尾韵。',
    tags: ['咖啡', '醇香', '到店享用'],
    category: 'cocktail',
    fulfillmentType: 'onsite',
    fulfillmentLabel: '到店享用',
    unitLabel: '杯',
    alcoholic: true,
    abv: 16,
    volumeMl: 180,
    enabled: false,
  },
  {
    id: 'cocktail-elderflower-zero',
    name: '接骨木花零度特调',
    price: 39,
    originalPrice: 39,
    imageUrl: '/static/images/shop/cocktail-elderflower-zero.jpg',
    description: '接骨木花、青柠与气泡水调出的无酒精花香特饮，清爽无负担。',
    tags: ['无酒精', '花香', '到店享用'],
    category: 'cocktail',
    fulfillmentType: 'onsite',
    fulfillmentLabel: '到店享用',
    unitLabel: '杯',
    alcoholic: false,
    abv: 0,
    volumeMl: 300,
    enabled: false,
  },
];

interface ShopStoreState {
  products: ShopProduct[];
}

const store: ShopStoreState = {
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

function persistProducts() {
  mkdirSync(path.dirname(storageFilePath), { recursive: true });
  writeFileSync(storageFilePath, JSON.stringify(store.products, null, 2), 'utf-8');
}

function loadProducts() {
  if (store.products.length > 0) {
    return;
  }

  if (!existsSync(storageFilePath)) {
    // 首次运行：写入种子数据。
    store.products = clone(DEFAULT_PRODUCTS);
    persistProducts();
    return;
  }

  try {
    const rawContent = readFileSync(storageFilePath, 'utf-8');
    const parsed = JSON.parse(rawContent) as ShopProduct[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      store.products = parsed.map((item) => normalizeShopProduct(item));
    } else {
      store.products = clone(DEFAULT_PRODUCTS);
      persistProducts();
    }
  } catch (error) {
    console.error('[shop store] load error', error);
    store.products = clone(DEFAULT_PRODUCTS);
    persistProducts();
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
