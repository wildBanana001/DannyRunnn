import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'shop.store.json');
/**
 * 内置的 6 条社畜主题商品种子数据。
 * 图片托管在 public/images/shop/ 下，通过 /static 路由对外访问。
 */
const DEFAULT_PRODUCTS = [
    {
        id: 'prod-coffee-box',
        name: '社畜续命挂耳咖啡礼盒',
        price: 59.9,
        originalPrice: 89,
        imageUrl: '/static/images/shop/product-1.png',
        description: '打工人早八续命必备，10 包精品挂耳，一口回魂，续航一整天。',
        stock: 200,
        tags: ['续命', '咖啡', '热销'],
    },
    {
        id: 'prod-fish-tote',
        name: '摸鱼快乐屋帆布袋',
        price: 39,
        originalPrice: 59,
        imageUrl: '/static/images/shop/product-2.png',
        description: '加厚帆布，容量超大，装下电脑也装得下摸鱼的心，通勤上班一包搞定。',
        stock: 150,
        tags: ['帆布袋', '通勤', '摸鱼'],
    },
    {
        id: 'prod-stress-ball',
        name: '打工人解压捏捏乐',
        price: 19.9,
        originalPrice: 29.9,
        imageUrl: '/static/images/shop/product-3.png',
        description: '开会想爆炸？捏它。需求又改了？捏它。软糯回弹，解压第一名。',
        stock: 300,
        tags: ['解压', '捏捏乐', '办公桌面'],
    },
    {
        id: 'prod-thermos-cup',
        name: '早八人保命保温杯',
        price: 69,
        originalPrice: 99,
        imageUrl: '/static/images/shop/product-4.png',
        description: '316 不锈钢内胆，12 小时长效保温，养生朋克的枸杞就靠它了。',
        stock: 120,
        tags: ['保温杯', '养生', '早八'],
    },
    {
        id: 'prod-monday-stickers',
        name: '周一不上班主题贴纸包',
        price: 12.9,
        originalPrice: 19.9,
        imageUrl: '/static/images/shop/product-5.png',
        description: '30 张防水贴纸，贴电脑贴水杯贴工牌，把不想上班写在脸上。',
        stock: 500,
        tags: ['贴纸', '周边', '低价'],
    },
    {
        id: 'prod-off-work-slippers',
        name: '社畜下班快乐拖鞋',
        price: 45,
        originalPrice: 69,
        imageUrl: '/static/images/shop/product-6.png',
        description: '踩屎感 EVA 鞋底，回家第一件事就是换上它，宣告今天的班上完了。',
        stock: 180,
        tags: ['拖鞋', '居家', '解放双脚'],
    },
];
const store = {
    products: [],
};
function clone(value) {
    return structuredClone(value);
}
function sanitizeString(value, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
}
function sanitizeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function normalizeProduct(item) {
    return {
        id: sanitizeString(item.id),
        name: sanitizeString(item.name),
        price: sanitizeNumber(item.price),
        originalPrice: sanitizeNumber(item.originalPrice),
        imageUrl: sanitizeString(item.imageUrl),
        description: sanitizeString(item.description),
        stock: sanitizeNumber(item.stock),
        tags: Array.isArray(item.tags) ? item.tags.map((tag) => sanitizeString(tag)).filter(Boolean) : [],
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
        const parsed = JSON.parse(rawContent);
        if (Array.isArray(parsed) && parsed.length > 0) {
            store.products = parsed.map((item) => normalizeProduct(item));
        }
        else {
            store.products = clone(DEFAULT_PRODUCTS);
            persistProducts();
        }
    }
    catch (error) {
        console.error('[shop store] load error', error);
        store.products = clone(DEFAULT_PRODUCTS);
        persistProducts();
    }
}
export function listProducts() {
    loadProducts();
    return clone(store.products);
}
export function getProductById(productId) {
    loadProducts();
    const record = store.products.find((item) => item.id === productId) ?? null;
    return record ? clone(record) : null;
}
