import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { getActivityById } from '../data/activities.js';
import { getProductById, listProducts } from '../data/shop.js';
import { createOrder, claimOrderPaymentPreparation, checkOrderStorageReady, finishOrderPaymentPreparation, getOrderById, getOrderStorageType, getOrdersByOpenid, getOrdersByProductId, updateOrderStatus, } from '../data/orders.js';
import { wxCloudrunAuth } from '../middlewares/wx-cloudrun-auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { buildJsapiPayParams, closeWechatPayOrder, createOutTradeNo, decryptNotifyResource, getWechatPayConfigurationStatus, isWechatPayConfigured, jsapiUnifiedOrder, queryWechatPayOrder, verifyWechatPaySignature, verifyWechatPayConnectivity, WechatPayApiError, } from '../utils/wechat-pay.js';
import { requireWxOpenid } from './utils.js';
export const shopRouter = Router();
const PAYMENT_EXPIRE_MINUTES = 15;
const PAYMENT_PREPARATION_LEASE_MILLISECONDS = 15_000;
const PAYMENT_PREPARATION_WAIT_DELAYS = [150, 350, 750, 1_200];
const CLIENT_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
class PaymentPreparationInProgressError extends Error {
    constructor() {
        super('支付参数正在生成，请稍后重试');
        this.name = 'PaymentPreparationInProgressError';
    }
}
function asyncHandler(handler) {
    return (request, response, next) => {
        Promise.resolve(handler(request, response, next)).catch(next);
    };
}
function sanitizeString(value, maxLength = 200) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
function parseQuantity(value) {
    const quantity = Number(value);
    return Number.isInteger(quantity) && quantity >= 1 && quantity <= 99 ? quantity : null;
}
function parseAddress(value) {
    if (!value || typeof value !== 'object')
        return null;
    const input = value;
    const address = {
        name: sanitizeString(input.name, 50),
        phone: sanitizeString(input.phone, 30),
        province: sanitizeString(input.province, 50),
        city: sanitizeString(input.city, 50),
        district: sanitizeString(input.district, 50),
        detail: sanitizeString(input.detail, 160),
    };
    if (!address.name || !address.phone || !address.detail || !/^[0-9+\-\s]{6,30}$/.test(address.phone)) {
        return null;
    }
    return address;
}
function parseActivityRegistration(value, activityId) {
    if (!value || typeof value !== 'object')
        return null;
    const input = value;
    const profileSnapshotInput = input.profileSnapshot && typeof input.profileSnapshot === 'object'
        ? input.profileSnapshot
        : input;
    const profileId = sanitizeString(input.profileId ?? input.id, 80);
    if (!profileId)
        return null;
    const genderInput = sanitizeString(profileSnapshotInput.gender, 20);
    const gender = genderInput === 'female' || genderInput === 'male' ? genderInput : 'other';
    const participantNickname = sanitizeString(input.participantNickname ?? input.nickname, 50) || '未命名用户';
    return {
        activityId,
        activityTitle: '',
        activityCover: '',
        profileId,
        participantNickname,
        wechatName: sanitizeString(input.wechatName, 80),
        phone: sanitizeString(input.phone, 30),
        profileSnapshot: {
            nickname: sanitizeString(profileSnapshotInput.nickname, 50) || participantNickname,
            gender,
            ageRange: sanitizeString(profileSnapshotInput.ageRange, 30),
            industry: sanitizeString(profileSnapshotInput.industry, 60),
            occupation: sanitizeString(profileSnapshotInput.occupation, 60),
            city: sanitizeString(profileSnapshotInput.city, 60),
            socialGoal: sanitizeString(profileSnapshotInput.socialGoal, 200),
            introduction: sanitizeString(profileSnapshotInput.introduction, 500),
        },
    };
}
function buildExpiresAt() {
    return new Date(Date.now() + PAYMENT_EXPIRE_MINUTES * 60 * 1000).toISOString();
}
function isExpired(order) {
    return Boolean(order.expiresAt && new Date(order.expiresAt).getTime() <= Date.now());
}
function wait(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}
function matchesPaymentRequest(order, input) {
    return order.kind === 'shop'
        && order.clientRequestId === input.clientRequestId
        && order.productId === input.productId
        && order.quantity === input.quantity
        && order.amount === input.amount;
}
function matchesActivityPaymentRequest(order, input) {
    return order.kind === 'activity'
        && order.clientRequestId === input.clientRequestId
        && order.productId === input.activityId
        && order.activityRegistration?.profileId === input.profileId
        && order.amount === input.amount;
}
function toPublicOrder(order) {
    return {
        id: order.id,
        clientRequestId: order.clientRequestId,
        productId: order.productId,
        productName: order.productName,
        productImageUrl: order.productImageUrl,
        unitPrice: order.unitPrice,
        quantity: order.quantity,
        amount: order.amount,
        address: order.address,
        remark: order.remark,
        status: order.status,
        mock: order.mock,
        transactionId: order.transactionId,
        paidAt: order.paidAt,
        expiresAt: order.expiresAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
    };
}
function toPaymentSession(order) {
    return {
        outTradeNo: order.id,
        amount: order.amount,
        status: order.status,
        mock: order.mock,
        ...(order.status === 'pending' && order.prepayId && !order.mock
            ? { payment: buildJsapiPayParams(order.prepayId) }
            : {}),
    };
}
function toActivityRegistration(order) {
    const snapshot = order.activityRegistration;
    if (!snapshot)
        throw new Error('活动报名快照缺失');
    const activity = getActivityById(snapshot.activityId);
    const originalPrice = order.unitPrice / 100;
    const payable = order.amount / 100;
    const amountPaid = order.status === 'paid' ? payable : 0;
    const status = order.status === 'paid' ? 'confirmed' : order.status === 'pending' ? 'pending' : 'cancelled';
    return {
        id: order.id,
        openid: order.openid,
        activityId: snapshot.activityId,
        activityTitle: snapshot.activityTitle,
        activityCover: snapshot.activityCover,
        profileId: snapshot.profileId,
        participantNickname: snapshot.participantNickname,
        wechatName: snapshot.wechatName,
        phone: snapshot.phone || undefined,
        useCard: false,
        originalPrice,
        cardOffset: 0,
        payable,
        deductionAmount: 0,
        amountPaid,
        status,
        registeredAt: order.createdAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        profileSnapshot: snapshot.profileSnapshot,
        activitySnapshot: activity,
        priceBreakdown: { originalPrice, cardOffset: 0, payable, amountPaid },
        paymentOrderStatus: order.status,
        paymentExpiresAt: order.expiresAt,
    };
}
function toActivityPaymentSession(order) {
    return {
        registration: toActivityRegistration(order),
        ...toPaymentSession(order),
    };
}
function validateWechatOrder(order, result) {
    if (result.appid && result.appid !== config.wechatPay.appId)
        throw new Error('微信支付订单 appid 不匹配');
    if (result.mchid && result.mchid !== config.wechatPay.mchId)
        throw new Error('微信支付订单 mchid 不匹配');
    if (result.out_trade_no && result.out_trade_no !== order.id)
        throw new Error('微信支付商户订单号不匹配');
    if (Number(result.amount?.total) !== order.amount)
        throw new Error('微信支付订单金额不匹配');
    if (result.amount?.currency && result.amount.currency !== 'CNY')
        throw new Error('微信支付订单币种不匹配');
}
async function applyWechatOrderState(order, result) {
    validateWechatOrder(order, result);
    if (result.trade_state === 'SUCCESS') {
        return await updateOrderStatus(order.id, 'paid', {
            transactionId: result.transaction_id,
            paidAt: result.success_time,
        }) || order;
    }
    if (result.trade_state === 'CLOSED' || result.trade_state === 'REVOKED') {
        return await updateOrderStatus(order.id, 'closed', { failureReason: result.trade_state_desc }) || order;
    }
    if (result.trade_state === 'PAYERROR') {
        return await updateOrderStatus(order.id, 'failed', { failureReason: result.trade_state_desc }) || order;
    }
    return order;
}
async function refreshWechatOrder(order) {
    if (order.mock || order.status !== 'pending' || !isWechatPayConfigured())
        return order;
    try {
        return await applyWechatOrderState(order, await queryWechatPayOrder(order.id));
    }
    catch (error) {
        if (error instanceof WechatPayApiError && error.code === 'ORDER_NOT_EXIST')
            return order;
        console.warn(`[shop] query order failed id=${order.id}`, error instanceof Error ? error.message : error);
        return order;
    }
}
function assertOrderOwner(order, openid, response) {
    if (!order) {
        response.status(404).json({ message: '订单不存在' });
        return false;
    }
    if (order.openid !== openid) {
        response.status(403).json({ message: '无权访问该订单' });
        return false;
    }
    return true;
}
async function prepareRealPayment(order) {
    if (order.prepayId)
        return order;
    const token = randomUUID();
    const claim = await claimOrderPaymentPreparation(order.id, token, PAYMENT_PREPARATION_LEASE_MILLISECONDS);
    if (!claim.order)
        throw new Error('订单不存在');
    if (claim.order.prepayId)
        return claim.order;
    if (!claim.claimed) {
        for (const delay of PAYMENT_PREPARATION_WAIT_DELAYS) {
            await wait(delay);
            const latest = await getOrderById(order.id);
            if (!latest)
                throw new Error('订单不存在');
            if (latest.prepayId)
                return latest;
            if (latest.status !== 'pending')
                return latest;
        }
        throw new PaymentPreparationInProgressError();
    }
    const claimedOrder = claim.order;
    let prepayId;
    try {
        prepayId = await jsapiUnifiedOrder({
            description: claimedOrder.kind === 'activity'
                ? claimedOrder.productName
                : `${claimedOrder.productName} x${claimedOrder.quantity}`,
            outTradeNo: claimedOrder.id,
            amountTotal: claimedOrder.amount,
            openid: claimedOrder.openid,
            timeExpire: claimedOrder.expiresAt,
            attach: claimedOrder.kind === 'activity' ? 'worker-house-activity' : 'worker-house-shop',
        });
    }
    catch (error) {
        const failureReason = error instanceof WechatPayApiError ? error.code : 'PREPAY_FAILED';
        try {
            await finishOrderPaymentPreparation(order.id, token, { prepayId: '', failureReason });
        }
        catch (storageError) {
            console.error(`[shop] release payment preparation failed id=${order.id}`, storageError instanceof Error ? storageError.message : storageError);
        }
        throw error;
    }
    let storageError;
    for (const delay of [0, 100, 300]) {
        if (delay > 0)
            await wait(delay);
        try {
            const prepared = await finishOrderPaymentPreparation(claimedOrder.id, token, {
                prepayId,
                failureReason: '',
            });
            if (!prepared?.prepayId)
                throw new Error('支付参数保存失败');
            return prepared;
        }
        catch (error) {
            storageError = error;
        }
    }
    console.error(`[shop] persist prepay_id failed id=${claimedOrder.id}`, storageError instanceof Error ? storageError.message : storageError);
    throw new Error('支付参数保存失败');
}
shopRouter.get('/products', (_request, response) => {
    const products = listProducts();
    response.json({ list: products, total: products.length });
});
shopRouter.get('/products/:id', (request, response) => {
    const product = getProductById(String(request.params.id));
    if (!product) {
        response.status(404).json({ message: '商品不存在' });
        return;
    }
    response.json(product);
});
shopRouter.get('/readiness', asyncHandler(async (_request, response) => {
    const paymentConfiguration = getWechatPayConfigurationStatus();
    const storageReady = await checkOrderStorageReady();
    const paymentReady = config.cloudMode === 'mock' || paymentConfiguration.ready;
    const ready = storageReady && paymentReady;
    response.status(ready ? 200 : 503).json({
        ready,
        mode: config.cloudMode,
        orderStorage: {
            ready: storageReady,
            type: getOrderStorageType(),
        },
        payment: {
            ready: paymentReady,
            keyMode: paymentConfiguration.keyMode,
        },
    });
}));
shopRouter.post('/readiness/verify', authMiddleware, asyncHandler(async (_request, response) => {
    const storageReady = await checkOrderStorageReady();
    if (!storageReady) {
        response.status(503).json({ ready: false, message: 'CloudBase 订单库尚未就绪' });
        return;
    }
    await verifyWechatPayConnectivity();
    response.json({ ready: true, verified: ['merchant_signature', 'wechatpay_response_signature'] });
}));
shopRouter.get('/orders/mine', wxCloudrunAuth, asyncHandler(async (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid)
        return;
    const orders = await getOrdersByOpenid(openid, 'shop');
    const pendingOrders = orders.filter((item) => item.status === 'pending').slice(0, 3);
    if (pendingOrders.length > 0 && config.cloudMode !== 'mock' && isWechatPayConfigured()) {
        await Promise.allSettled(pendingOrders.map((item) => refreshWechatOrder(item)));
    }
    const refreshedOrders = await getOrdersByOpenid(openid, 'shop');
    response.json({ list: refreshedOrders.map(toPublicOrder), total: refreshedOrders.length });
}));
shopRouter.get('/orders/:id', wxCloudrunAuth, asyncHandler(async (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid)
        return;
    const order = await getOrderById(String(request.params.id));
    if (!assertOrderOwner(order, openid, response))
        return;
    if (order.kind !== 'shop') {
        response.status(404).json({ message: '商城订单不存在' });
        return;
    }
    response.json(toPublicOrder(await refreshWechatOrder(order)));
}));
shopRouter.post('/orders/pay', wxCloudrunAuth, asyncHandler(async (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid)
        return;
    try {
        const productId = sanitizeString(request.body?.productId, 80);
        const quantity = parseQuantity(request.body?.quantity);
        const address = parseAddress(request.body?.address);
        const remark = sanitizeString(request.body?.remark, 80);
        const clientRequestId = sanitizeString(request.body?.clientRequestId, 64);
        if (!productId || !quantity || !address || !CLIENT_REQUEST_ID_PATTERN.test(clientRequestId)) {
            response.status(400).json({ message: '订单参数不完整或格式错误' });
            return;
        }
        const product = getProductById(productId);
        if (!product) {
            response.status(404).json({ message: '商品不存在' });
            return;
        }
        if (product.stock <= 0 || quantity > product.stock) {
            response.status(409).json({ message: '商品库存不足' });
            return;
        }
        const unitPrice = Math.round(product.price * 100);
        const amount = unitPrice * quantity;
        if (!Number.isSafeInteger(amount) || amount <= 0) {
            response.status(400).json({ message: '订单金额异常' });
            return;
        }
        const outTradeNo = createOutTradeNo(openid, clientRequestId);
        const paymentRequest = { clientRequestId, productId, quantity, amount };
        const existing = await getOrderById(outTradeNo);
        if (existing) {
            if (!matchesPaymentRequest(existing, paymentRequest)) {
                response.status(409).json({ message: '重复请求与原订单信息不一致，请刷新页面重试' });
                return;
            }
            if (existing.status === 'paid') {
                response.json(toPaymentSession(existing));
                return;
            }
            if (existing.status !== 'pending' || isExpired(existing)) {
                response.status(409).json({ message: '原订单已失效，请刷新页面重新下单' });
                return;
            }
            const prepared = config.cloudMode === 'mock' ? existing : await prepareRealPayment(existing);
            response.json(toPaymentSession(prepared));
            return;
        }
        const expiresAt = buildExpiresAt();
        const isMockPayment = config.cloudMode === 'mock';
        if (!isMockPayment && !isWechatPayConfigured()) {
            response.status(503).json({ message: '微信支付尚未完成配置，请联系管理员' });
            return;
        }
        let order = await createOrder({
            id: outTradeNo,
            kind: 'shop',
            clientRequestId,
            productId: product.id,
            productName: product.name,
            productImageUrl: product.imageUrl,
            unitPrice,
            quantity,
            amount,
            address,
            openid,
            remark,
            status: isMockPayment ? 'paid' : 'pending',
            mock: isMockPayment,
            transactionId: isMockPayment ? `MOCK_TX_${Date.now()}` : '',
            paidAt: isMockPayment ? new Date().toISOString() : '',
            expiresAt,
        });
        if (!matchesPaymentRequest(order, paymentRequest)) {
            response.status(409).json({ message: '重复请求与原订单信息不一致，请刷新页面重试' });
            return;
        }
        if (!isMockPayment) {
            order = await prepareRealPayment(order);
        }
        response.json(toPaymentSession(order));
    }
    catch (error) {
        console.error('[shop] create payment failed', error instanceof Error ? error.message : error);
        if (error instanceof PaymentPreparationInProgressError) {
            response.status(409).json({ message: error.message });
            return;
        }
        response.status(error instanceof WechatPayApiError ? 502 : 500)
            .json({ message: '支付订单创建失败，请稍后重试' });
    }
}));
shopRouter.post('/orders/:id/retry', wxCloudrunAuth, asyncHandler(async (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid)
        return;
    const order = await getOrderById(String(request.params.id));
    if (!assertOrderOwner(order, openid, response))
        return;
    if (order.kind !== 'shop') {
        response.status(404).json({ message: '商城订单不存在' });
        return;
    }
    const refreshed = await refreshWechatOrder(order);
    if (refreshed.status === 'paid') {
        response.json(toPaymentSession(refreshed));
        return;
    }
    if (refreshed.status !== 'pending') {
        response.status(409).json({ message: '该订单当前无法继续支付' });
        return;
    }
    if (isExpired(refreshed)) {
        if (!refreshed.mock && isWechatPayConfigured()) {
            try {
                await closeWechatPayOrder(refreshed.id);
            }
            catch (error) {
                console.warn(`[shop] close expired order failed id=${refreshed.id}`, error instanceof Error ? error.message : error);
            }
        }
        await updateOrderStatus(refreshed.id, 'closed', { failureReason: '订单支付超时' });
        response.status(409).json({ message: '订单已超时，请重新下单' });
        return;
    }
    try {
        response.json(toPaymentSession(refreshed.mock ? refreshed : await prepareRealPayment(refreshed)));
    }
    catch (error) {
        console.error('[shop] retry payment failed', error instanceof Error ? error.message : error);
        response.status(error instanceof PaymentPreparationInProgressError ? 409 : 502)
            .json({ message: error instanceof PaymentPreparationInProgressError ? error.message : '暂时无法继续支付，请稍后重试' });
    }
}));
shopRouter.get('/activity-registrations/mine', wxCloudrunAuth, asyncHandler(async (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid)
        return;
    const orders = await getOrdersByOpenid(openid, 'activity');
    const pendingOrders = orders.filter((item) => item.status === 'pending').slice(0, 5);
    if (pendingOrders.length > 0 && config.cloudMode !== 'mock' && isWechatPayConfigured()) {
        await Promise.allSettled(pendingOrders.map((item) => refreshWechatOrder(item)));
    }
    const refreshedOrders = await getOrdersByOpenid(openid, 'activity');
    response.json({
        list: refreshedOrders.map(toActivityRegistration),
        total: refreshedOrders.length,
    });
}));
shopRouter.get('/activity-registrations/:id', wxCloudrunAuth, asyncHandler(async (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid)
        return;
    const order = await getOrderById(String(request.params.id));
    if (!assertOrderOwner(order, openid, response))
        return;
    if (order.kind !== 'activity') {
        response.status(404).json({ message: '报名记录不存在' });
        return;
    }
    response.json(toActivityRegistration(await refreshWechatOrder(order)));
}));
shopRouter.post('/activity-registrations/pay', wxCloudrunAuth, asyncHandler(async (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid)
        return;
    try {
        const activityId = sanitizeString(request.body?.activityId, 80);
        const clientRequestId = sanitizeString(request.body?.clientRequestId, 64);
        const profile = parseActivityRegistration(request.body?.profile, activityId);
        if (!activityId || !profile || !CLIENT_REQUEST_ID_PATTERN.test(clientRequestId)) {
            response.status(400).json({ message: '报名参数不完整或格式错误' });
            return;
        }
        if (request.body?.useCard) {
            response.status(400).json({ message: '微信支付报名暂不支持次卡抵扣，请关闭次卡后重试' });
            return;
        }
        const activity = getActivityById(activityId);
        if (!activity || activity.enabled === false) {
            response.status(404).json({ message: '活动不存在或已下架' });
            return;
        }
        const amount = Math.round(activity.price * 100);
        if (!Number.isSafeInteger(amount) || amount < 0) {
            response.status(400).json({ message: '活动金额异常' });
            return;
        }
        const outTradeNo = createOutTradeNo(openid, clientRequestId, 'WA');
        const paymentRequest = { clientRequestId, activityId, profileId: profile.profileId, amount };
        const existing = await getOrderById(outTradeNo);
        if (existing) {
            if (!matchesActivityPaymentRequest(existing, paymentRequest)) {
                response.status(409).json({ message: '重复请求与原报名信息不一致，请刷新页面重试' });
                return;
            }
            if (existing.status === 'paid') {
                response.json(toActivityPaymentSession(existing));
                return;
            }
            if (existing.status !== 'pending' || isExpired(existing)) {
                response.status(409).json({ message: '原报名支付单已失效，请刷新页面重新报名' });
                return;
            }
            const prepared = config.cloudMode === 'mock' ? existing : await prepareRealPayment(existing);
            response.json(toActivityPaymentSession(prepared));
            return;
        }
        const ownActivityOrders = (await getOrdersByOpenid(openid, 'activity'))
            .filter((item) => item.productId === activityId);
        for (const previous of ownActivityOrders) {
            const refreshed = previous.status === 'pending' ? await refreshWechatOrder(previous) : previous;
            if (refreshed.status === 'paid') {
                response.json(toActivityPaymentSession(refreshed));
                return;
            }
            if (refreshed.status === 'pending' && !isExpired(refreshed)) {
                const prepared = config.cloudMode === 'mock' ? refreshed : await prepareRealPayment(refreshed);
                response.json(toActivityPaymentSession(prepared));
                return;
            }
            if (refreshed.status === 'pending' && isExpired(refreshed)) {
                await updateOrderStatus(refreshed.id, 'closed', { failureReason: '报名支付超时' });
            }
        }
        const activityOrders = await getOrdersByProductId(activityId, 'activity');
        const reservedCount = activityOrders.filter((item) => (item.status === 'paid' || (item.status === 'pending' && !isExpired(item)))).length;
        if (activity.maxParticipants > 0 && activity.currentParticipants + reservedCount >= activity.maxParticipants) {
            response.status(409).json({ message: '活动名额已满' });
            return;
        }
        const isMockPayment = config.cloudMode === 'mock';
        const isFreeRegistration = amount === 0;
        if (!isMockPayment && !isFreeRegistration && !isWechatPayConfigured()) {
            response.status(503).json({ message: '微信支付尚未完成配置，请联系管理员' });
            return;
        }
        const timestamp = new Date().toISOString();
        let order = await createOrder({
            id: outTradeNo,
            kind: 'activity',
            clientRequestId,
            productId: activity.id,
            productName: activity.title,
            productImageUrl: activity.cover || activity.coverImage,
            unitPrice: amount,
            quantity: 1,
            amount,
            address: { name: '', phone: '', province: '', city: '', district: '', detail: '' },
            openid,
            remark: 'activity-registration',
            activityRegistration: {
                ...profile,
                activityTitle: activity.title,
                activityCover: activity.cover || activity.coverImage,
            },
            status: isMockPayment || isFreeRegistration ? 'paid' : 'pending',
            mock: isMockPayment,
            transactionId: isMockPayment
                ? `MOCK_ACTIVITY_${Date.now()}`
                : isFreeRegistration
                    ? `FREE_ACTIVITY_${Date.now()}`
                    : '',
            paidAt: isMockPayment || isFreeRegistration ? timestamp : '',
            expiresAt: buildExpiresAt(),
        });
        if (!matchesActivityPaymentRequest(order, paymentRequest)) {
            response.status(409).json({ message: '重复请求与原报名信息不一致，请刷新页面重试' });
            return;
        }
        if (!isMockPayment && !isFreeRegistration) {
            order = await prepareRealPayment(order);
        }
        response.status(201).json(toActivityPaymentSession(order));
    }
    catch (error) {
        console.error('[activity-payment] create failed', error instanceof Error ? error.message : error);
        if (error instanceof PaymentPreparationInProgressError) {
            response.status(409).json({ message: error.message });
            return;
        }
        response.status(error instanceof WechatPayApiError ? 502 : 500)
            .json({ message: '活动支付单创建失败，请稍后重试' });
    }
}));
shopRouter.post('/activity-registrations/:id/retry', wxCloudrunAuth, asyncHandler(async (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid)
        return;
    const order = await getOrderById(String(request.params.id));
    if (!assertOrderOwner(order, openid, response))
        return;
    if (order.kind !== 'activity') {
        response.status(404).json({ message: '报名记录不存在' });
        return;
    }
    const refreshed = await refreshWechatOrder(order);
    if (refreshed.status === 'paid') {
        response.json(toActivityPaymentSession(refreshed));
        return;
    }
    if (refreshed.status !== 'pending') {
        response.status(409).json({ message: '该报名当前无法继续支付' });
        return;
    }
    if (isExpired(refreshed)) {
        if (!refreshed.mock && isWechatPayConfigured()) {
            try {
                await closeWechatPayOrder(refreshed.id);
            }
            catch (error) {
                console.warn(`[activity-payment] close expired order failed id=${refreshed.id}`, error instanceof Error ? error.message : error);
            }
        }
        await updateOrderStatus(refreshed.id, 'closed', { failureReason: '报名支付超时' });
        response.status(409).json({ message: '报名支付单已超时，请重新报名' });
        return;
    }
    try {
        response.json(toActivityPaymentSession(refreshed.mock ? refreshed : await prepareRealPayment(refreshed)));
    }
    catch (error) {
        console.error('[activity-payment] retry failed', error instanceof Error ? error.message : error);
        response.status(error instanceof PaymentPreparationInProgressError ? 409 : 502)
            .json({ message: error instanceof PaymentPreparationInProgressError ? error.message : '暂时无法继续支付，请稍后重试' });
    }
}));
shopRouter.post('/orders/notify', asyncHandler(async (request, response) => {
    try {
        if (!isWechatPayConfigured()) {
            response.status(503).json({ code: 'FAIL', message: '微信支付尚未完成配置' });
            return;
        }
        const signatureValid = verifyWechatPaySignature({
            nonce: request.header('wechatpay-nonce')?.trim() || '',
            rawBody: request.rawBody || '',
            serialNo: request.header('wechatpay-serial')?.trim() || '',
            signature: request.header('wechatpay-signature')?.trim() || '',
            timestamp: request.header('wechatpay-timestamp')?.trim() || '',
        });
        if (!signatureValid) {
            response.status(401).json({ code: 'FAIL', message: '微信支付回调验签失败' });
            return;
        }
        const body = (request.body ?? {});
        if (!body.id || !body.resource?.ciphertext) {
            response.status(400).json({ code: 'FAIL', message: '回调数据格式错误' });
            return;
        }
        if (body.event_type && body.event_type !== 'TRANSACTION.SUCCESS') {
            response.status(400).json({ code: 'FAIL', message: '不支持的支付通知类型' });
            return;
        }
        if (body.resource.original_type && body.resource.original_type !== 'transaction') {
            response.status(400).json({ code: 'FAIL', message: '支付通知资源类型错误' });
            return;
        }
        const decrypted = decryptNotifyResource(body.resource);
        const outTradeNo = sanitizeString(decrypted.out_trade_no, 32);
        const tradeState = sanitizeString(decrypted.trade_state, 32);
        const transactionId = sanitizeString(decrypted.transaction_id, 64);
        const order = await getOrderById(outTradeNo);
        if (!order) {
            response.status(404).json({ code: 'FAIL', message: '商户订单不存在' });
            return;
        }
        if (order.lastNotifyId === body.id) {
            response.status(204).send();
            return;
        }
        const amount = decrypted.amount && typeof decrypted.amount === 'object'
            ? decrypted.amount
            : {};
        const appid = sanitizeString(decrypted.appid, 64);
        const mchid = sanitizeString(decrypted.mchid, 64);
        if (appid !== config.wechatPay.appId
            || mchid !== config.wechatPay.mchId
            || Number(amount.total) !== order.amount
            || (amount.currency && amount.currency !== 'CNY')) {
            response.status(400).json({ code: 'FAIL', message: '支付回调业务数据不匹配' });
            return;
        }
        if (tradeState !== 'SUCCESS' || !transactionId) {
            response.status(400).json({ code: 'FAIL', message: '支付状态不是成功' });
            return;
        }
        if (order.status === 'paid' && order.transactionId && order.transactionId !== transactionId) {
            console.error(`[shop] paid transaction mismatch id=${outTradeNo}`);
            response.status(409).json({ code: 'FAIL', message: '支付流水号与已入账记录不一致' });
            return;
        }
        await updateOrderStatus(outTradeNo, 'paid', {
            transactionId,
            paidAt: sanitizeString(decrypted.success_time, 64),
            notifyId: body.id,
        });
        response.status(204).send();
    }
    catch (error) {
        console.error('[shop] payment notify failed', error instanceof Error ? error.message : error);
        response.status(500).json({ code: 'FAIL', message: '回调处理失败' });
    }
}));
