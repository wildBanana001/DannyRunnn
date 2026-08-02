import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { ActivityCapacityExceededError, buildNewOrderRecord, cloneOrder, hasActivePaymentPreparation, isActiveActivityOrder, normalizeOrder, nowIso, sanitizeOrderNumber, sanitizeOrderString, } from './order-model.js';
import { checkMysqlOrderStorageReady, claimMysqlOrderPaymentPreparation, createMysqlActivityOrderWithCapacity, createMysqlOrder, finishMysqlOrderPaymentPreparation, getMysqlOrderById, getMysqlOrdersByKind, getMysqlOrdersByOpenid, getMysqlOrdersByProductId, updateMysqlOrderStatus, } from './mysql-orders.js';
export { ActivityCapacityExceededError, isActivityCapacityExceededError, } from './order-model.js';
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'orders.store.json');
const store = { orders: [] };
function usesMysqlStorage() {
    return config.shopOrderStorage === 'mysql';
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
export async function createOrder(input) {
    const record = buildNewOrderRecord(input);
    if (usesMysqlStorage()) {
        if (record.kind !== 'shop') {
            const error = new Error('活动订单必须通过名额事务创建');
            error.code = 'ACTIVITY_CAPACITY_TRANSACTION_REQUIRED';
            throw error;
        }
        return createMysqlOrder(record);
    }
    loadOrders();
    const duplicate = store.orders.find((item) => item.id === record.id);
    if (duplicate)
        return cloneOrder(duplicate);
    store.orders.unshift(record);
    persistOrders();
    return cloneOrder(record);
}
function findActiveActivityOrder(productId, openid) {
    const matches = store.orders.filter((item) => (item.productId === productId
        && item.openid === openid
        && isActiveActivityOrder(item)));
    return matches.find((item) => item.status === 'paid') ?? matches[0] ?? null;
}
export async function createActivityOrderWithCapacity(input, capacity) {
    const record = buildNewOrderRecord(input);
    if (usesMysqlStorage())
        return createMysqlActivityOrderWithCapacity(record, capacity);
    loadOrders();
    const duplicate = store.orders.find((item) => item.id === record.id);
    if (duplicate)
        return cloneOrder(duplicate);
    const existing = findActiveActivityOrder(record.productId, record.openid);
    if (existing)
        return cloneOrder(existing);
    const activeReservations = store.orders.filter((item) => (item.productId === record.productId && isActiveActivityOrder(item))).length;
    const currentParticipants = Math.max(0, Math.floor(sanitizeOrderNumber(capacity.currentParticipants)));
    const maxParticipants = Math.max(0, Math.floor(sanitizeOrderNumber(capacity.maxParticipants)));
    if (maxParticipants > 0 && currentParticipants + activeReservations + 1 > maxParticipants) {
        throw new ActivityCapacityExceededError();
    }
    store.orders.unshift(record);
    persistOrders();
    return cloneOrder(record);
}
export async function getOrderById(orderId) {
    const normalizedOrderId = sanitizeOrderString(orderId);
    if (!normalizedOrderId)
        return null;
    if (usesMysqlStorage())
        return getMysqlOrderById(normalizedOrderId);
    loadOrders();
    const record = store.orders.find((item) => item.id === normalizedOrderId) ?? null;
    return record ? cloneOrder(record) : null;
}
export async function getOrdersByOpenid(openid, kind) {
    const normalizedOpenid = sanitizeOrderString(openid);
    if (!normalizedOpenid)
        return [];
    if (usesMysqlStorage())
        return getMysqlOrdersByOpenid(normalizedOpenid, kind);
    loadOrders();
    return cloneOrder(store.orders
        .filter((item) => item.openid === normalizedOpenid && (!kind || item.kind === kind))
        .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()));
}
export async function getOrdersByProductId(productId, kind) {
    const normalizedProductId = sanitizeOrderString(productId);
    if (!normalizedProductId)
        return [];
    if (usesMysqlStorage())
        return getMysqlOrdersByProductId(normalizedProductId, kind);
    loadOrders();
    return cloneOrder(store.orders.filter((item) => (item.productId === normalizedProductId && (!kind || item.kind === kind))));
}
export async function getOrdersByKind(kind) {
    if (usesMysqlStorage())
        return getMysqlOrdersByKind(kind);
    loadOrders();
    return cloneOrder(store.orders
        .filter((item) => item.kind === kind)
        .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()));
}
export async function claimOrderPaymentPreparation(orderId, token, leaseMilliseconds) {
    const normalizedOrderId = sanitizeOrderString(orderId);
    const normalizedToken = sanitizeOrderString(token);
    if (usesMysqlStorage()) {
        return claimMysqlOrderPaymentPreparation(normalizedOrderId, normalizedToken, leaseMilliseconds);
    }
    const preparingUntil = new Date(Date.now() + Math.max(1_000, leaseMilliseconds)).toISOString();
    loadOrders();
    const index = store.orders.findIndex((item) => item.id === normalizedOrderId);
    if (index === -1)
        return { claimed: false, order: null };
    const current = store.orders[index];
    if (current.status !== 'pending' || current.prepayId || hasActivePaymentPreparation(current)) {
        return { claimed: false, order: cloneOrder(current) };
    }
    store.orders[index] = normalizeOrder({
        ...current,
        paymentPreparationToken: normalizedToken,
        paymentPreparingUntil: preparingUntil,
        updatedAt: nowIso(),
    });
    persistOrders();
    return { claimed: true, order: cloneOrder(store.orders[index]) };
}
export async function finishOrderPaymentPreparation(orderId, token, input) {
    const normalizedOrderId = sanitizeOrderString(orderId);
    const normalizedToken = sanitizeOrderString(token);
    if (usesMysqlStorage()) {
        return finishMysqlOrderPaymentPreparation(normalizedOrderId, normalizedToken, input);
    }
    loadOrders();
    const index = store.orders.findIndex((item) => item.id === normalizedOrderId);
    if (index === -1)
        return null;
    const current = store.orders[index];
    if (current.prepayId || current.status !== 'pending')
        return cloneOrder(current);
    if (current.paymentPreparationToken !== normalizedToken)
        return cloneOrder(current);
    store.orders[index] = normalizeOrder({
        ...current,
        prepayId: sanitizeOrderString(input.prepayId),
        failureReason: sanitizeOrderString(input.failureReason),
        paymentPreparationToken: '',
        paymentPreparingUntil: '',
        updatedAt: nowIso(),
    });
    persistOrders();
    return cloneOrder(store.orders[index]);
}
export async function updateOrderStatus(orderId, status, options = {}) {
    const normalizedOrderId = sanitizeOrderString(orderId);
    if (usesMysqlStorage())
        return updateMysqlOrderStatus(normalizedOrderId, status, options);
    loadOrders();
    const index = store.orders.findIndex((item) => item.id === normalizedOrderId);
    if (index === -1)
        return null;
    const current = store.orders[index];
    if (current.status === 'paid' && status !== 'paid')
        return cloneOrder(current);
    if (current.status === 'paid'
        && status === 'paid'
        && current.transactionId
        && options.transactionId
        && current.transactionId !== options.transactionId) {
        const error = new Error('已支付订单的微信支付流水号不一致');
        error.code = 'PAYMENT_TRANSACTION_CONFLICT';
        throw error;
    }
    const updatedAt = nowIso();
    const next = normalizeOrder({
        ...current,
        status,
        transactionId: options.transactionId || current.transactionId,
        paidAt: status === 'paid' ? (options.paidAt || current.paidAt || updatedAt) : current.paidAt,
        failureReason: options.failureReason ?? current.failureReason,
        lastNotifyId: options.notifyId || current.lastNotifyId,
        paymentPreparationToken: status === 'pending' ? current.paymentPreparationToken : '',
        paymentPreparingUntil: status === 'pending' ? current.paymentPreparingUntil : '',
        updatedAt,
    });
    store.orders[index] = next;
    persistOrders();
    return cloneOrder(next);
}
export async function settleFreeOrder(order) {
    if (order.amount !== 0 || order.status !== 'pending')
        return cloneOrder(order);
    const transactionId = `${order.kind === 'activity' ? 'FREE_ACTIVITY' : 'FREE_SHOP'}_${order.id}`;
    const paidAt = nowIso();
    const settled = await updateOrderStatus(order.id, 'paid', { transactionId, paidAt });
    if (!settled)
        throw new Error('订单不存在');
    return settled;
}
export function getOrderStorageType() {
    return config.shopOrderStorage;
}
export async function checkOrderStorageReady() {
    if (usesMysqlStorage())
        return checkMysqlOrderStorageReady();
    return config.cloudMode !== 'cloudrun' || config.allowEphemeralCloudrunData;
}
