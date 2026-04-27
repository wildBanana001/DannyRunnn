import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCardPackageById } from './cardPackages.js';
import { cardOrderSeedData } from './seed.js';
import { clone, memoryStore, now } from './store.js';
import { getProfileById, resolveProfileForRegistration } from './profiles.js';
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'cardOrders.store.json');
function createId(prefix) {
    return `${prefix}-${randomUUID().slice(0, 8)}`;
}
function sanitizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function sanitizeNumber(value, fallback) {
    const nextValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(nextValue) ? nextValue : fallback;
}
function isExpired(expiresAt) {
    if (!expiresAt) {
        return false;
    }
    return new Date(expiresAt).getTime() <= Date.now();
}
function resolveCardOrderStatus(status, remainingCount, expiresAt) {
    const normalizedStatus = sanitizeString(status);
    if (normalizedStatus === 'refunded') {
        return 'refunded';
    }
    if (normalizedStatus === 'expired') {
        return 'expired';
    }
    if (isExpired(expiresAt)) {
        return 'expired';
    }
    if (normalizedStatus === 'exhausted' || remainingCount <= 0) {
        return 'exhausted';
    }
    return 'active';
}
function sortUsageLogs(list) {
    return [...list].sort((first, second) => new Date(second.usedAt).getTime() - new Date(first.usedAt).getTime());
}
function sortAdjustLogs(list) {
    return [...list].sort((first, second) => new Date(second.at).getTime() - new Date(first.at).getTime());
}
function sortOrders(list) {
    return [...list].sort((first, second) => {
        const timeDiff = new Date(second.purchasedAt).getTime() - new Date(first.purchasedAt).getTime();
        if (timeDiff !== 0) {
            return timeDiff;
        }
        return second.id.localeCompare(first.id);
    });
}
function resolveProfile(openid, profileId) {
    const profile = profileId ? getProfileById(openid, profileId) : resolveProfileForRegistration(openid);
    if (!profile) {
        throw new Error('请先创建用户档案');
    }
    return profile;
}
function buildExpiresAt(validDays, fallbackExpiresAt) {
    const normalizedExpiresAt = sanitizeString(fallbackExpiresAt);
    if (normalizedExpiresAt) {
        return normalizedExpiresAt;
    }
    if (!validDays || !Number.isFinite(validDays) || validDays <= 0) {
        return undefined;
    }
    const target = new Date();
    target.setUTCDate(target.getUTCDate() + Math.floor(validDays));
    return target.toISOString();
}
function normalizeUsageLog(record) {
    return {
        id: sanitizeString(record.id) || createId('usage'),
        registrationId: sanitizeString(record.registrationId) || undefined,
        activityId: sanitizeString(record.activityId) || '',
        activityTitle: sanitizeString(record.activityTitle) || '未命名活动',
        usedAt: sanitizeString(record.usedAt) || now(),
        deductionCount: Math.max(1, Math.floor(sanitizeNumber(record.deductionCount, 1))),
        deductionAmount: Math.max(0, sanitizeNumber(record.deductionAmount, 0)),
        operatorName: sanitizeString(record.operatorName) || '系统',
        status: sanitizeString(record.status) === 'reverted' ? 'reverted' : 'used',
        note: sanitizeString(record.note) || undefined,
    };
}
function normalizeAdjustLog(record) {
    const fromRemainingCount = record.from?.remainingCount;
    const toRemainingCount = record.to?.remainingCount;
    return {
        at: sanitizeString(record.at) || now(),
        by: sanitizeString(record.by) || '系统',
        from: {
            remainingCount: Number.isFinite(fromRemainingCount) ? Number(fromRemainingCount) : undefined,
            expiresAt: sanitizeString(record.from?.expiresAt) || undefined,
            status: sanitizeString(record.from?.status) || undefined,
        },
        reason: sanitizeString(record.reason) || '手动调整',
        to: {
            remainingCount: Number.isFinite(toRemainingCount) ? Number(toRemainingCount) : undefined,
            expiresAt: sanitizeString(record.to?.expiresAt) || undefined,
            status: sanitizeString(record.to?.status) || undefined,
        },
    };
}
function normalizeCardOrder(record) {
    const totalCount = Math.max(1, Math.floor(sanitizeNumber(record.totalCount, 1)));
    const remainingCount = Math.max(0, Math.min(totalCount, Math.floor(sanitizeNumber(record.remainingCount, totalCount))));
    const usedCount = Math.max(0, Math.floor(sanitizeNumber(record.usedCount, totalCount - remainingCount)));
    const expiresAt = sanitizeString(record.expiresAt) || undefined;
    return {
        id: sanitizeString(record.id) || createId('card'),
        openid: sanitizeString(record.openid) || '',
        profileId: sanitizeString(record.profileId) || '',
        userNickname: sanitizeString(record.userNickname) || '未命名档案',
        userWechatName: sanitizeString(record.userWechatName) || '',
        cardType: sanitizeString(record.cardType) || `${totalCount} 次卡`,
        totalCount,
        usedCount,
        remainingCount,
        amount: Math.max(0, sanitizeNumber(record.amount, 0)),
        purchasedAt: sanitizeString(record.purchasedAt) || now(),
        status: resolveCardOrderStatus(record.status, remainingCount, expiresAt),
        expiresAt,
        usageLogs: sortUsageLogs(Array.isArray(record.usageLogs) ? record.usageLogs.map((item) => normalizeUsageLog(item)) : []),
        packageId: sanitizeString(record.packageId) || undefined,
        perUseMaxOffset: Math.max(0, sanitizeNumber(record.perUseMaxOffset, 148)),
        validDays: Math.max(0, Math.floor(sanitizeNumber(record.validDays, 0))) || undefined,
        adjustLogs: sortAdjustLogs(Array.isArray(record.adjustLogs) ? record.adjustLogs.map((item) => normalizeAdjustLog(item)) : []),
    };
}
function persistCardOrders() {
    mkdirSync(path.dirname(storageFilePath), { recursive: true });
    writeFileSync(storageFilePath, JSON.stringify(memoryStore.cardOrders, null, 2), 'utf-8');
}
function loadCardOrders() {
    if (memoryStore.cardOrders.length > 0) {
        return;
    }
    if (!existsSync(storageFilePath)) {
        memoryStore.cardOrders = sortOrders(cardOrderSeedData.map((item) => normalizeCardOrder(item)));
        persistCardOrders();
        return;
    }
    try {
        const rawContent = readFileSync(storageFilePath, 'utf-8');
        const parsed = JSON.parse(rawContent);
        if (!Array.isArray(parsed)) {
            throw new Error('次卡订单数据格式错误');
        }
        memoryStore.cardOrders = sortOrders(parsed.map((item) => normalizeCardOrder(item)));
    }
    catch {
        memoryStore.cardOrders = sortOrders(cardOrderSeedData.map((item) => normalizeCardOrder(item)));
        persistCardOrders();
    }
}
function isOrderUsable(order) {
    return resolveCardOrderStatus(order.status, order.remainingCount, order.expiresAt) === 'active' && order.remainingCount > 0;
}
function buildCardOrder(openid, profile, input) {
    const matchedPackage = input.packageId ? getCardPackageById(sanitizeString(input.packageId)) : null;
    const totalCount = Math.max(1, Math.floor(sanitizeNumber(input.totalCount, matchedPackage?.totalCount ?? 10)));
    const amount = Math.max(0, sanitizeNumber(input.amount, matchedPackage?.price ?? totalCount * 99));
    const perUseMaxOffset = Math.max(0, sanitizeNumber(input.perUseMaxOffset, matchedPackage?.perUseMaxOffset ?? 148));
    const validDays = Math.max(0, Math.floor(sanitizeNumber(input.validDays, matchedPackage?.validDays ?? 0))) || undefined;
    const timestamp = now();
    return normalizeCardOrder({
        id: createId('card'),
        openid,
        profileId: profile.id,
        userNickname: sanitizeString(input.userNickname) || profile.nickname,
        userWechatName: sanitizeString(input.userWechatName) || profile.wechatName,
        cardType: sanitizeString(input.cardType) || matchedPackage?.name || `${totalCount} 次卡`,
        totalCount,
        usedCount: 0,
        remainingCount: totalCount,
        amount,
        purchasedAt: timestamp,
        status: 'active',
        expiresAt: buildExpiresAt(validDays, input.expiresAt),
        usageLogs: [],
        packageId: matchedPackage?.id,
        perUseMaxOffset,
        validDays,
        adjustLogs: [],
    });
}
loadCardOrders();
export function listCardOrdersByOpenid(openid) {
    loadCardOrders();
    return clone(sortOrders(memoryStore.cardOrders.filter((item) => item.openid === openid).map((item) => normalizeCardOrder(item))));
}
export function listAllCardOrders() {
    loadCardOrders();
    return clone(sortOrders(memoryStore.cardOrders.map((item) => normalizeCardOrder(item))));
}
export function getCardOrderById(openid, cardOrderId) {
    loadCardOrders();
    const record = memoryStore.cardOrders.find((item) => item.openid === openid && item.id === cardOrderId) ?? null;
    return clone(record ? normalizeCardOrder(record) : null);
}
export function getCardOrderByIdUnsafe(cardOrderId) {
    loadCardOrders();
    const record = memoryStore.cardOrders.find((item) => item.id === cardOrderId) ?? null;
    return clone(record ? normalizeCardOrder(record) : null);
}
export function getUsageLogsByCardOrderId(openid, cardOrderId) {
    const order = getCardOrderById(openid, cardOrderId);
    return order ? clone(sortUsageLogs(order.usageLogs)) : null;
}
export function findUsableCardOrder(openid, profileId, cardOrderId) {
    loadCardOrders();
    if (cardOrderId) {
        const exact = memoryStore.cardOrders.find((item) => item.openid === openid && item.profileId === profileId && item.id === cardOrderId);
        return exact && isOrderUsable(exact) ? clone(normalizeCardOrder(exact)) : null;
    }
    const usable = sortOrders(memoryStore.cardOrders.filter((item) => item.openid === openid && item.profileId === profileId && isOrderUsable(item)));
    return clone(usable[0] ? normalizeCardOrder(usable[0]) : null);
}
export function createCardOrder(openid, input) {
    loadCardOrders();
    const profile = resolveProfile(openid, input.profileId);
    const record = buildCardOrder(openid, profile, input);
    memoryStore.cardOrders = sortOrders([record, ...memoryStore.cardOrders]);
    persistCardOrders();
    return clone(record);
}
export function applyCardUsage(input) {
    loadCardOrders();
    const targetOrder = findUsableCardOrder(input.openid, input.profileId, input.cardOrderId);
    if (!targetOrder) {
        return null;
    }
    const usageLog = {
        id: createId('usage'),
        registrationId: input.registrationId,
        activityId: input.activityId,
        activityTitle: input.activityTitle,
        usedAt: now(),
        deductionCount: 1,
        deductionAmount: input.deductionAmount,
        operatorName: input.operatorName,
        status: 'used',
        note: input.note,
    };
    const nextOrder = normalizeCardOrder({
        ...targetOrder,
        usedCount: targetOrder.usedCount + 1,
        remainingCount: Math.max(0, targetOrder.remainingCount - 1),
        usageLogs: [usageLog, ...targetOrder.usageLogs],
    });
    memoryStore.cardOrders = sortOrders(memoryStore.cardOrders.map((item) => (item.id === nextOrder.id ? nextOrder : item)));
    persistCardOrders();
    return clone({ order: nextOrder, usageLog });
}
export function updateCardOrderStatus(cardOrderId, status) {
    return updateCardOrder(cardOrderId, {
        status,
        reason: '更新次卡状态',
        updatedBy: '系统',
    });
}
export function updateCardOrder(cardOrderId, input) {
    loadCardOrders();
    const current = memoryStore.cardOrders.find((item) => item.id === cardOrderId);
    if (!current) {
        return null;
    }
    const hasRemainingCount = typeof input.remainingCount !== 'undefined';
    const nextRemainingCount = hasRemainingCount
        ? Math.max(0, Math.min(current.totalCount, Math.floor(sanitizeNumber(input.remainingCount, current.remainingCount))))
        : current.remainingCount;
    const nextExpiresAt = typeof input.expiresAt === 'undefined'
        ? current.expiresAt
        : sanitizeString(input.expiresAt) || undefined;
    const explicitStatus = sanitizeString(input.status);
    const nextStatus = resolveCardOrderStatus(explicitStatus || current.status, nextRemainingCount, nextExpiresAt);
    const nextOrder = normalizeCardOrder({
        ...current,
        remainingCount: nextRemainingCount,
        usedCount: Math.max(0, current.totalCount - nextRemainingCount),
        expiresAt: nextExpiresAt,
        status: nextStatus,
        adjustLogs: [
            {
                at: now(),
                by: sanitizeString(input.updatedBy) || '系统',
                from: {
                    remainingCount: current.remainingCount,
                    expiresAt: current.expiresAt,
                    status: current.status,
                },
                reason: sanitizeString(input.reason) || '手动调整',
                to: {
                    remainingCount: nextRemainingCount,
                    expiresAt: nextExpiresAt,
                    status: nextStatus,
                },
            },
            ...(current.adjustLogs ?? []),
        ],
    });
    memoryStore.cardOrders = sortOrders(memoryStore.cardOrders.map((item) => (item.id === cardOrderId ? nextOrder : item)));
    persistCardOrders();
    return clone(nextOrder);
}
