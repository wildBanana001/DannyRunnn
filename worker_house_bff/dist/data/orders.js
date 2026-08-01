import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'orders.store.json');
const store = { orders: [] };
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
    if (value === 'paid' || value === 'failed' || value === 'closed') {
        return value;
    }
    return 'pending';
}
function normalizeAddress(value) {
    return {
        name: sanitizeString(value?.name),
        phone: sanitizeString(value?.phone),
        province: sanitizeString(value?.province),
        city: sanitizeString(value?.city),
        district: sanitizeString(value?.district),
        detail: sanitizeString(value?.detail),
    };
}
function normalizeOrder(item) {
    const createdAt = sanitizeString(item.createdAt) || now();
    const unitPrice = sanitizeNumber(item.unitPrice, item.quantity ? sanitizeNumber(item.amount) / sanitizeNumber(item.quantity, 1) : 0);
    return {
        id: sanitizeString(item.id),
        clientRequestId: sanitizeString(item.clientRequestId) || sanitizeString(item.id),
        productId: sanitizeString(item.productId),
        productName: sanitizeString(item.productName),
        productImageUrl: sanitizeString(item.productImageUrl),
        unitPrice: Math.max(0, Math.round(unitPrice)),
        quantity: Math.max(1, Math.floor(sanitizeNumber(item.quantity, 1))),
        amount: Math.max(0, Math.round(sanitizeNumber(item.amount))),
        address: normalizeAddress(item.address),
        openid: sanitizeString(item.openid),
        remark: sanitizeString(item.remark),
        status: sanitizeStatus(item.status),
        mock: Boolean(item.mock),
        prepayId: sanitizeString(item.prepayId),
        transactionId: sanitizeString(item.transactionId),
        paidAt: sanitizeString(item.paidAt),
        expiresAt: sanitizeString(item.expiresAt),
        failureReason: sanitizeString(item.failureReason),
        lastNotifyId: sanitizeString(item.lastNotifyId),
        createdAt,
        updatedAt: sanitizeString(item.updatedAt) || createdAt,
    };
}
function persistOrders() {
    mkdirSync(path.dirname(storageFilePath), { recursive: true });
    writeFileSync(storageFilePath, JSON.stringify(store.orders, null, 2), 'utf-8');
}
function loadOrders() {
    if (store.orders.length > 0)
        return;
    if (!existsSync(storageFilePath)) {
        store.orders = [];
        return;
    }
    try {
        const parsed = JSON.parse(readFileSync(storageFilePath, 'utf-8'));
        store.orders = Array.isArray(parsed) ? parsed.map(normalizeOrder) : [];
    }
    catch (error) {
        console.error('[orders store] load error', error);
        store.orders = [];
    }
}
export function createOrder(input) {
    loadOrders();
    const duplicate = store.orders.find((item) => item.id === input.id);
    if (duplicate)
        return clone(duplicate);
    const record = normalizeOrder({
        ...input,
        remark: input.remark ?? '',
        status: input.status ?? 'pending',
        mock: input.mock ?? false,
        prepayId: input.prepayId ?? '',
        transactionId: input.transactionId ?? '',
        paidAt: input.paidAt ?? '',
        createdAt: now(),
        updatedAt: now(),
    });
    store.orders.unshift(record);
    persistOrders();
    return clone(record);
}
export function getOrderById(orderId) {
    loadOrders();
    const record = store.orders.find((item) => item.id === sanitizeString(orderId)) ?? null;
    return record ? clone(record) : null;
}
export function getOrderByClientRequestId(openid, clientRequestId) {
    loadOrders();
    const normalizedOpenid = sanitizeString(openid);
    const normalizedRequestId = sanitizeString(clientRequestId);
    const record = store.orders.find((item) => (item.openid === normalizedOpenid && item.clientRequestId === normalizedRequestId)) ?? null;
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
export function updateOrderPayment(orderId, input) {
    loadOrders();
    const index = store.orders.findIndex((item) => item.id === orderId);
    if (index === -1)
        return null;
    store.orders[index] = normalizeOrder({
        ...store.orders[index],
        ...input,
        updatedAt: now(),
    });
    persistOrders();
    return clone(store.orders[index]);
}
export function updateOrderStatus(orderId, status, options = {}) {
    loadOrders();
    const index = store.orders.findIndex((item) => item.id === orderId);
    if (index === -1)
        return null;
    const current = store.orders[index];
    if (current.status === 'paid' && status !== 'paid') {
        return clone(current);
    }
    const next = normalizeOrder({
        ...current,
        status,
        transactionId: options.transactionId || current.transactionId,
        paidAt: status === 'paid' ? (options.paidAt || current.paidAt || now()) : current.paidAt,
        failureReason: options.failureReason ?? current.failureReason,
        lastNotifyId: options.notifyId || current.lastNotifyId,
        updatedAt: now(),
    });
    store.orders[index] = next;
    persistOrders();
    return clone(next);
}
