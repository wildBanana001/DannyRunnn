export class ActivityCapacityExceededError extends Error {
    code = 'ACTIVITY_CAPACITY_EXCEEDED';
    constructor() {
        super('活动名额已满');
        this.name = 'ActivityCapacityExceededError';
    }
}
export function isActivityCapacityExceededError(error) {
    if (error instanceof ActivityCapacityExceededError)
        return true;
    if (!error || typeof error !== 'object')
        return false;
    const input = error;
    return input.code === 'ACTIVITY_CAPACITY_EXCEEDED'
        || input.name === 'ActivityCapacityExceededError'
        || (typeof input.message === 'string' && input.message.includes('活动名额已满'));
}
export function cloneOrder(value) {
    return structuredClone(value);
}
export function nowIso() {
    return new Date().toISOString();
}
export function sanitizeOrderString(value, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
}
export function sanitizeOrderNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function sanitizeStatus(value) {
    if (value === 'paid' || value === 'failed' || value === 'closed')
        return value;
    return 'pending';
}
function sanitizeOrderKind(value) {
    return value === 'activity' ? 'activity' : 'shop';
}
function sanitizeFulfillmentType(value, fallback) {
    return value === 'delivery' || value === 'onsite' || value === 'pickup' ? value : fallback;
}
function getDefaultFulfillmentLabel(type, kind) {
    if (type === 'onsite')
        return kind === 'activity' ? '现场参与' : '到店享用';
    if (type === 'pickup')
        return '到店自提';
    return '快递配送';
}
function normalizeActivityRegistration(value) {
    if (!value || typeof value !== 'object')
        return undefined;
    const profileSnapshot = value.profileSnapshot && typeof value.profileSnapshot === 'object'
        ? value.profileSnapshot
        : {};
    const gender = profileSnapshot.gender === 'female' || profileSnapshot.gender === 'male'
        ? profileSnapshot.gender
        : 'other';
    return {
        activityId: sanitizeOrderString(value.activityId),
        activityTitle: sanitizeOrderString(value.activityTitle),
        activityCover: sanitizeOrderString(value.activityCover),
        profileId: sanitizeOrderString(value.profileId),
        participantNickname: sanitizeOrderString(value.participantNickname),
        wechatName: sanitizeOrderString(value.wechatName),
        phone: sanitizeOrderString(value.phone),
        profileSnapshot: {
            nickname: sanitizeOrderString(profileSnapshot.nickname),
            gender,
            ageRange: sanitizeOrderString(profileSnapshot.ageRange),
            industry: sanitizeOrderString(profileSnapshot.industry),
            occupation: sanitizeOrderString(profileSnapshot.occupation),
            city: sanitizeOrderString(profileSnapshot.city),
            socialGoal: sanitizeOrderString(profileSnapshot.socialGoal),
            introduction: sanitizeOrderString(profileSnapshot.introduction),
        },
    };
}
function normalizeAddress(value) {
    if (!value || typeof value !== 'object')
        return null;
    const address = {
        name: sanitizeOrderString(value.name),
        phone: sanitizeOrderString(value.phone),
        province: sanitizeOrderString(value.province),
        city: sanitizeOrderString(value.city),
        district: sanitizeOrderString(value.district),
        detail: sanitizeOrderString(value.detail),
    };
    return Object.values(address).some(Boolean) ? address : null;
}
export function normalizeOrder(item) {
    const createdAt = sanitizeOrderString(item.createdAt) || nowIso();
    const unitPrice = sanitizeOrderNumber(item.unitPrice, item.quantity ? sanitizeOrderNumber(item.amount) / sanitizeOrderNumber(item.quantity, 1) : 0);
    const kind = sanitizeOrderKind(item.kind);
    const fulfillmentType = sanitizeFulfillmentType(item.fulfillmentType, kind === 'activity' ? 'onsite' : 'delivery');
    return {
        id: sanitizeOrderString(item.id),
        kind,
        clientRequestId: sanitizeOrderString(item.clientRequestId) || sanitizeOrderString(item.id),
        productId: sanitizeOrderString(item.productId),
        productName: sanitizeOrderString(item.productName),
        productImageUrl: sanitizeOrderString(item.productImageUrl),
        unitPrice: Math.max(0, Math.round(unitPrice)),
        quantity: Math.max(1, Math.floor(sanitizeOrderNumber(item.quantity, 1))),
        amount: Math.max(0, Math.round(sanitizeOrderNumber(item.amount))),
        address: normalizeAddress(item.address),
        fulfillmentType,
        fulfillmentLabel: sanitizeOrderString(item.fulfillmentLabel)
            || getDefaultFulfillmentLabel(fulfillmentType, kind),
        unitLabel: sanitizeOrderString(item.unitLabel) || (kind === 'activity' ? '位' : '件'),
        openid: sanitizeOrderString(item.openid),
        remark: sanitizeOrderString(item.remark),
        activityRegistration: normalizeActivityRegistration(item.activityRegistration),
        status: sanitizeStatus(item.status),
        mock: Boolean(item.mock),
        prepayId: sanitizeOrderString(item.prepayId),
        paymentPreparationToken: sanitizeOrderString(item.paymentPreparationToken),
        paymentPreparingUntil: sanitizeOrderString(item.paymentPreparingUntil),
        transactionId: sanitizeOrderString(item.transactionId),
        paidAt: sanitizeOrderString(item.paidAt),
        expiresAt: sanitizeOrderString(item.expiresAt),
        failureReason: sanitizeOrderString(item.failureReason),
        lastNotifyId: sanitizeOrderString(item.lastNotifyId),
        createdAt,
        updatedAt: sanitizeOrderString(item.updatedAt) || createdAt,
    };
}
export function buildNewOrderRecord(input) {
    const timestamp = nowIso();
    return normalizeOrder({
        ...input,
        remark: input.remark ?? '',
        status: input.status ?? 'pending',
        mock: input.mock ?? false,
        prepayId: input.prepayId ?? '',
        transactionId: input.transactionId ?? '',
        paidAt: input.paidAt ?? '',
        createdAt: timestamp,
        updatedAt: timestamp,
    });
}
export function isActiveActivityOrder(order) {
    return order.kind === 'activity' && (order.status === 'pending' || order.status === 'paid');
}
export function hasActivePaymentPreparation(order) {
    const preparingUntil = Date.parse(order.paymentPreparingUntil);
    return Boolean(order.paymentPreparationToken
        && Number.isFinite(preparingUntil)
        && preparingUntil > Date.now());
}
