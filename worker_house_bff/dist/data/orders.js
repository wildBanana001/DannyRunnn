import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'orders.store.json');
const store = {
    orders: [],
};
function clone(value) {
    return structuredClone(value);
}
function now() {
    return new Date().toISOString();
}
function sanitizeString(value, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
}
function sanitizeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function sanitizeStatus(value) {
    return value === 'paid' || value === 'failed' ? value : 'pending';
}
function normalizeOrder(item) {
    return {
        id: sanitizeString(item.id),
        productId: sanitizeString(item.productId),
        productName: sanitizeString(item.productName),
        quantity: sanitizeNumber(item.quantity, 1),
        amount: sanitizeNumber(item.amount),
        openid: sanitizeString(item.openid),
        remark: sanitizeString(item.remark),
        status: sanitizeStatus(item.status),
        mock: Boolean(item.mock),
        prepayId: sanitizeString(item.prepayId),
        transactionId: sanitizeString(item.transactionId),
        createdAt: sanitizeString(item.createdAt) || now(),
        updatedAt: sanitizeString(item.updatedAt) || now(),
    };
}
function persistOrders() {
    mkdirSync(path.dirname(storageFilePath), { recursive: true });
    writeFileSync(storageFilePath, JSON.stringify(store.orders, null, 2), 'utf-8');
}
function loadOrders() {
    if (store.orders.length > 0) {
        return;
    }
    if (!existsSync(storageFilePath)) {
        store.orders = [];
        return;
    }
    try {
        const rawContent = readFileSync(storageFilePath, 'utf-8');
        const parsed = JSON.parse(rawContent);
        store.orders = Array.isArray(parsed) ? parsed.map((item) => normalizeOrder(item)) : [];
    }
    catch (error) {
        console.error('[orders store] load error', error);
        store.orders = [];
    }
}
export function createOrder(input) {
    loadOrders();
    const record = normalizeOrder({
        ...input,
        remark: input.remark ?? '',
        status: input.status ?? 'pending',
        mock: input.mock ?? false,
        prepayId: input.prepayId ?? '',
        createdAt: now(),
        updatedAt: now(),
    });
    store.orders.unshift(record);
    persistOrders();
    return clone(record);
}
export function getOrderById(orderId) {
    loadOrders();
    const record = store.orders.find((item) => item.id === orderId) ?? null;
    return record ? clone(record) : null;
}
export function getOrdersByOpenid(openid) {
    loadOrders();
    const normalizedOpenid = sanitizeString(openid);
    if (!normalizedOpenid)
        return [];
    return clone(store.orders
        .filter((item) => item.openid === normalizedOpenid)
        .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()));
}
export function updateOrderStatus(orderId, status, transactionId) {
    loadOrders();
    const index = store.orders.findIndex((item) => item.id === orderId);
    if (index === -1) {
        return null;
    }
    const next = {
        ...store.orders[index],
        status,
        transactionId: transactionId ? sanitizeString(transactionId) : store.orders[index].transactionId,
        updatedAt: now(),
    };
    store.orders[index] = next;
    persistOrders();
    return clone(next);
}
