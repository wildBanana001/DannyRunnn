import { Router } from 'express';
import { callCloudFunction } from '../cloudClient.js';
import { isOpenidAdmin } from '../config/adminWhitelist.js';
import { listActivities, deleteActivity, getActivityById, upsertActivity } from '../data/activities.js';
import { archiveCardPackage, createCardPackage, getCardPackageById, listCardPackages, updateCardPackage } from '../data/cardPackages.js';
import { getCardOrderByIdUnsafe, listAllCardOrders, updateCardOrder } from '../data/cardOrders.js';
import { getRegistrationByIdUnsafe, listAllRegistrations, updateRegistrationStatus } from '../data/registrations.js';
import { getSiteConfig, updateSiteConfig } from '../data/siteConfig.js';
import { openidAdminAuth, resolveAdminOpenid } from '../middleware/openidAdminAuth.js';
import { buildCloudStoragePath, uploadToWechatCloudStorage } from '../wechatStorage.js';
import { upload, toSingleUploadSource } from './upload.js';
import { paginate, parsePage } from './utils.js';
const adminCloudFunctionToken = 'worker-house-admin-token';
const registrationStatuses = new Set(['pending', 'confirmed', 'cancelled', 'completed', 'refunded']);
const cardOrderStatuses = new Set(['active', 'exhausted', 'expired', 'refunded']);
function sanitizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function parseBoolean(value, fallback = false) {
    if (value === true || value === 'true') {
        return true;
    }
    if (value === false || value === 'false') {
        return false;
    }
    return fallback;
}
function compareDateDesc(firstValue, secondValue) {
    return new Date(secondValue).getTime() - new Date(firstValue).getTime();
}
function buildPagedResult(records, page, pageSize) {
    const paged = paginate(records, page, pageSize);
    return {
        data: paged.list,
        list: paged.list,
        page,
        pageSize,
        total: paged.total,
    };
}
function normalizeRegistrationStatus(value) {
    const normalizedValue = sanitizeString(value);
    return registrationStatuses.has(normalizedValue) ? normalizedValue : null;
}
function normalizeCardOrderStatus(value) {
    const normalizedValue = sanitizeString(value);
    return cardOrderStatuses.has(normalizedValue) ? normalizedValue : null;
}
function normalizeAdminMiniPost(record) {
    const pinned = Boolean(record.isPinned ?? record.pinned);
    const createdAt = String(record.createdAt ?? new Date().toISOString());
    const updatedAt = String(record.updatedAt ?? record.createdAt ?? new Date().toISOString());
    const commentsCount = Number(record.commentsCount ?? record.comments ?? 0);
    return {
        id: String(record.id ?? record._id ?? ''),
        authorAvatar: record.authorAvatar ? String(record.authorAvatar) : undefined,
        authorId: String(record.authorId ?? ''),
        authorNickname: String(record.authorNickname ?? '匿名用户'),
        color: record.color,
        comments: commentsCount,
        commentsCount,
        content: String(record.content ?? ''),
        createdAt,
        idAlias: record._id ? String(record._id) : undefined,
        images: Array.isArray(record.images) ? record.images.map((item) => String(item)) : [],
        isAnonymous: Boolean(record.isAnonymous),
        isLiked: Boolean(record.isLiked),
        isPinned: pinned,
        likes: Number(record.likes ?? 0),
        pinned,
        tags: Array.isArray(record.tags) ? record.tags.map((item) => String(item)) : [],
        title: String(record.title ?? record.content ?? '').trim().slice(0, 18) || '未命名留言',
        updatedAt,
    };
}
function normalizeAdminMiniPoster(record) {
    const coverImage = sanitizeString(record.coverImage)
        || (Array.isArray(record.detailImages) ? sanitizeString(record.detailImages[0]) : '');
    const status = sanitizeString(record.status) === 'offline' || record.enabled === false ? 'offline' : 'online';
    const detailImages = Array.isArray(record.detailImages)
        ? record.detailImages.map((item) => String(item)).filter(Boolean)
        : coverImage
            ? [coverImage]
            : [];
    const createdAt = String(record.createdAt ?? new Date().toISOString());
    return {
        id: String(record.id ?? record._id ?? ''),
        title: String(record.title ?? ''),
        coverImage,
        detailImages: detailImages.length ? detailImages : coverImage ? [coverImage] : [],
        enabled: status === 'online',
        linkUrl: sanitizeString(record.linkUrl),
        relatedActivityId: sanitizeString(record.relatedActivityId),
        status,
        sort: Number(record.sort ?? 0),
        createdAt,
        updatedAt: String(record.updatedAt ?? createdAt),
    };
}
function buildPosterPayload(input, current) {
    const status = sanitizeString(input.status) === 'offline' || input.enabled === false
        ? 'offline'
        : sanitizeString(input.status) === 'online' || input.enabled === true
            ? 'online'
            : current?.status ?? 'online';
    const coverImage = sanitizeString(input.coverImage) || current?.coverImage || '';
    const detailImages = Array.isArray(input.detailImages)
        ? input.detailImages.map((item) => String(item)).filter(Boolean)
        : current?.detailImages ?? [];
    return {
        title: sanitizeString(input.title) || current?.title || '',
        coverImage,
        detailImages: detailImages.length ? detailImages : coverImage ? [coverImage] : [],
        enabled: status === 'online',
        linkUrl: sanitizeString(input.linkUrl) || current?.linkUrl || '',
        relatedActivityId: sanitizeString(input.relatedActivityId) || current?.relatedActivityId || '',
        status,
        sort: Number(input.sort ?? current?.sort ?? 0),
    };
}
function matchKeyword(values, keyword) {
    if (!keyword) {
        return true;
    }
    return values.some((value) => sanitizeString(value).toLowerCase().includes(keyword));
}
function buildRegistrationDetail(record) {
    const activitySnapshot = getActivityById(record.activityId);
    const cardOrder = record.cardOrderId ? getCardOrderByIdUnsafe(record.cardOrderId) : null;
    const cardUsageLog = cardOrder?.usageLogs.find((item) => item.id === record.cardUsageLogId) ?? null;
    return {
        ...record,
        activitySnapshot,
        cardOrder,
        cardUsageLog,
        priceBreakdown: {
            amountPaid: record.amountPaid,
            cardOffset: record.cardOffset,
            originalPrice: record.originalPrice,
            payable: record.payable,
        },
    };
}
async function fetchAdminMiniPosterList() {
    const result = await callCloudFunction('poster', {
        action: 'list',
    });
    if (!result.success) {
        return result;
    }
    const list = Array.isArray(result.data)
        ? result.data.map((item) => normalizeAdminMiniPoster(item))
        : [];
    list.sort((first, second) => {
        if (first.status !== second.status) {
            return first.status === 'online' ? -1 : 1;
        }
        if (first.sort !== second.sort) {
            return first.sort - second.sort;
        }
        return compareDateDesc(first.createdAt, second.createdAt);
    });
    return {
        success: true,
        data: list,
    };
}
async function fetchAdminMiniPosterDetail(id) {
    const result = await callCloudFunction('poster', {
        action: 'get',
        id,
    });
    if (!result.success) {
        return result;
    }
    return {
        success: true,
        data: normalizeAdminMiniPoster(result.data),
    };
}
export const adminMiniRouter = Router();
adminMiniRouter.post('/check', (request, response) => {
    const openid = resolveAdminOpenid(request);
    response.json({
        isAdmin: isOpenidAdmin(openid),
        openid,
    });
});
adminMiniRouter.use(openidAdminAuth);
adminMiniRouter.put('/site-config', (request, response) => {
    try {
        const body = (request.body ?? {});
        const updated = updateSiteConfig({
            aboutUs: typeof body.aboutUs === 'string' ? body.aboutUs : undefined,
            communityQrcode: typeof body.communityQrcode === 'string' ? body.communityQrcode : undefined,
            contactWechat: typeof body.contactWechat === 'string' ? body.contactWechat : undefined,
            heroSlogan: typeof body.heroSlogan === 'string' ? body.heroSlogan : undefined,
            heroTitle: typeof body.heroTitle === 'string' ? body.heroTitle : undefined,
        }, resolveAdminOpenid(request));
        response.json(updated);
    }
    catch (error) {
        response.status(500).json({ message: error instanceof Error ? error.message : '更新站点配置失败' });
    }
});
adminMiniRouter.get('/activities', (request, response) => {
    const page = parsePage(request.query.page, 1);
    const pageSize = Math.min(parsePage(request.query.pageSize, 30), 200);
    const status = typeof request.query.status === 'string' ? request.query.status.trim() : '';
    const keyword = typeof request.query.keyword === 'string' ? request.query.keyword.trim().toLowerCase() : '';
    let records = listActivities();
    if (status) {
        records = records.filter((item) => item.status === status);
    }
    if (keyword) {
        records = records.filter((item) => item.title.toLowerCase().includes(keyword));
    }
    response.json({
        ...paginate(records, page, pageSize),
        page,
        pageSize,
    });
});
adminMiniRouter.post('/activities', (request, response) => {
    const record = upsertActivity(undefined, request.body);
    response.json(record);
});
adminMiniRouter.put('/activities/:id', (request, response) => {
    const existing = listActivities().find((item) => item.id === String(request.params.id));
    if (!existing) {
        response.status(404).json({ message: '活动不存在' });
        return;
    }
    const record = upsertActivity(existing.id, request.body);
    response.json(record);
});
adminMiniRouter.delete('/activities/:id', (request, response) => {
    const deleted = deleteActivity(String(request.params.id));
    if (!deleted) {
        response.status(404).json({ message: '活动不存在' });
        return;
    }
    response.json({ success: true });
});
adminMiniRouter.get('/registrations', (request, response) => {
    const page = parsePage(request.query.page, 1);
    const pageSize = Math.min(parsePage(request.query.pageSize, 20), 100);
    const activityId = sanitizeString(request.query.activityId);
    const status = normalizeRegistrationStatus(request.query.status);
    const keyword = sanitizeString(request.query.keyword).toLowerCase();
    let records = listAllRegistrations({
        activityId: activityId || undefined,
        status: status ?? undefined,
    });
    if (keyword) {
        records = records.filter((item) => matchKeyword([
            item.participantNickname,
            item.wechatName,
            item.phone,
        ], keyword));
    }
    const detailList = records.map((item) => ({
        ...item,
        activitySnapshot: getActivityById(item.activityId),
    }));
    response.json(buildPagedResult(detailList, page, pageSize));
});
adminMiniRouter.get('/registrations/:id', (request, response) => {
    const record = getRegistrationByIdUnsafe(String(request.params.id));
    if (!record) {
        response.status(404).json({ message: '报名记录不存在' });
        return;
    }
    response.json({ data: buildRegistrationDetail(record) });
});
adminMiniRouter.patch('/registrations/:id/status', (request, response) => {
    const status = normalizeRegistrationStatus(request.body?.status);
    if (!status || !['confirmed', 'cancelled', 'refunded'].includes(status)) {
        response.status(400).json({ message: '状态不合法' });
        return;
    }
    const record = updateRegistrationStatus(String(request.params.id), status);
    if (!record) {
        response.status(404).json({ message: '报名记录不存在' });
        return;
    }
    response.json({ data: buildRegistrationDetail(record) });
});
adminMiniRouter.get('/card-orders', (request, response) => {
    const page = parsePage(request.query.page, 1);
    const pageSize = Math.min(parsePage(request.query.pageSize, 20), 100);
    const userId = sanitizeString(request.query.userId);
    const cardType = sanitizeString(request.query.cardType);
    const status = normalizeCardOrderStatus(request.query.status);
    const keyword = sanitizeString(request.query.keyword).toLowerCase();
    let records = listAllCardOrders();
    if (userId) {
        records = records.filter((item) => item.openid === userId);
    }
    if (cardType) {
        records = records.filter((item) => item.cardType === cardType);
    }
    if (status) {
        records = records.filter((item) => item.status === status);
    }
    if (keyword) {
        records = records.filter((item) => matchKeyword([
            item.id,
            item.openid,
            item.userNickname,
            item.userWechatName,
            item.cardType,
        ], keyword));
    }
    response.json(buildPagedResult(records, page, pageSize));
});
adminMiniRouter.get('/card-orders/:id', (request, response) => {
    const order = getCardOrderByIdUnsafe(String(request.params.id));
    if (!order) {
        response.status(404).json({ message: '次卡订单不存在' });
        return;
    }
    response.json({
        data: {
            ...order,
            usageLogs: order.usageLogs,
        },
    });
});
adminMiniRouter.patch('/card-orders/:id', (request, response) => {
    const status = typeof request.body?.status === 'undefined' ? undefined : normalizeCardOrderStatus(request.body?.status);
    if (typeof request.body?.status !== 'undefined' && !status) {
        response.status(400).json({ message: '状态不合法' });
        return;
    }
    const order = updateCardOrder(String(request.params.id), {
        expiresAt: typeof request.body?.expiresAt === 'string' ? request.body.expiresAt : undefined,
        reason: typeof request.body?.reason === 'string' ? request.body.reason : undefined,
        remainingCount: typeof request.body?.remainingCount === 'undefined' ? undefined : Number(request.body.remainingCount),
        status: status ?? undefined,
        updatedBy: resolveAdminOpenid(request),
    });
    if (!order) {
        response.status(404).json({ message: '次卡订单不存在' });
        return;
    }
    response.json({
        data: {
            ...order,
            usageLogs: order.usageLogs,
        },
    });
});
adminMiniRouter.get('/card-packages', (_request, response) => {
    const list = listCardPackages({ includeArchived: true });
    response.json({ data: list, list, total: list.length });
});
adminMiniRouter.post('/card-packages', (request, response) => {
    const payload = request.body;
    const record = createCardPackage(payload);
    response.status(201).json({ data: record });
});
adminMiniRouter.put('/card-packages/:id', (request, response) => {
    const current = getCardPackageById(String(request.params.id));
    if (!current) {
        response.status(404).json({ message: '次卡套餐不存在' });
        return;
    }
    const record = updateCardPackage(current.id, request.body);
    response.json({ data: record });
});
adminMiniRouter.delete('/card-packages/:id', (request, response) => {
    const record = archiveCardPackage(String(request.params.id));
    if (!record) {
        response.status(404).json({ message: '次卡套餐不存在' });
        return;
    }
    response.json({ data: record });
});
adminMiniRouter.post('/upload', upload.single('file'), async (request, response, next) => {
    try {
        const source = toSingleUploadSource(request);
        const result = await uploadToWechatCloudStorage(source, buildCloudStoragePath('admin-mini', source.fileName));
        response.json(result);
    }
    catch (error) {
        next(error);
    }
});
adminMiniRouter.get('/stats', async (_request, response) => {
    try {
        const [postResult] = await Promise.all([
            callCloudFunction('post', {
                action: 'list',
            }),
        ]);
        if (!postResult.success) {
            response.status(400).json({ message: postResult.error });
            return;
        }
        const activities = listActivities();
        const endedCount = activities.filter((item) => item.status === 'ended').length;
        const ongoingCount = activities.filter((item) => item.status === 'ongoing').length;
        response.json({
            activities: {
                total: activities.length,
                ongoing: ongoingCount,
                ended: endedCount,
            },
            posts: {
                total: Array.isArray(postResult.data) ? postResult.data.length : 0,
            },
            registrations: {
                total: listAllRegistrations().length,
            },
            cardOrders: {
                total: listAllCardOrders().length,
            },
        });
    }
    catch (error) {
        response.status(500).json({ message: error instanceof Error ? error.message : '获取统计数据失败' });
    }
});
adminMiniRouter.get('/posts', async (request, response) => {
    const page = parsePage(request.query.page, 1);
    const pageSize = Math.min(parsePage(request.query.pageSize, 20), 200);
    try {
        const result = await callCloudFunction('post', {
            action: 'list',
        });
        if (!result.success) {
            response.status(400).json({ message: result.error });
            return;
        }
        const list = (Array.isArray(result.data) ? result.data : [])
            .map((item) => normalizeAdminMiniPost(item))
            .sort((first, second) => {
            if (first.pinned !== second.pinned) {
                return Number(second.pinned) - Number(first.pinned);
            }
            return compareDateDesc(first.createdAt, second.createdAt);
        });
        response.json({
            ...paginate(list, page, pageSize),
            page,
            pageSize,
        });
    }
    catch (error) {
        response.status(500).json({ message: error instanceof Error ? error.message : '获取帖子列表失败' });
    }
});
adminMiniRouter.delete('/posts/:id', async (request, response) => {
    try {
        const result = await callCloudFunction('post', {
            action: 'delete',
            id: String(request.params.id),
            token: adminCloudFunctionToken,
        });
        if (!result.success) {
            response.status(400).json({ message: result.error });
            return;
        }
        response.json({ success: true });
    }
    catch (error) {
        response.status(500).json({ message: error instanceof Error ? error.message : '删除帖子失败' });
    }
});
adminMiniRouter.put('/posts/:id/pin', async (request, response) => {
    const pinned = parseBoolean(request.body?.pinned);
    try {
        const result = await callCloudFunction('post', {
            action: 'pin',
            id: String(request.params.id),
            isPinned: pinned,
            pinned,
            token: adminCloudFunctionToken,
        });
        if (!result.success) {
            response.status(400).json({ message: result.error });
            return;
        }
        const detail = await callCloudFunction('post', {
            action: 'get',
            id: String(request.params.id),
        });
        if (!detail.success || !detail.data.post) {
            response.json({ success: true, pinned });
            return;
        }
        response.json(normalizeAdminMiniPost(detail.data.post));
    }
    catch (error) {
        response.status(500).json({ message: error instanceof Error ? error.message : '更新帖子置顶状态失败' });
    }
});
adminMiniRouter.get('/posters', async (request, response) => {
    const page = parsePage(request.query.page, 1);
    const pageSize = Math.min(parsePage(request.query.pageSize, 50), 200);
    try {
        const result = await fetchAdminMiniPosterList();
        if (!result.success) {
            response.status(400).json({ message: result.error });
            return;
        }
        response.json({
            ...paginate(result.data, page, pageSize),
            page,
            pageSize,
        });
    }
    catch (error) {
        response.status(500).json({ message: error instanceof Error ? error.message : '获取海报列表失败' });
    }
});
adminMiniRouter.post('/posters', async (request, response) => {
    try {
        const payload = buildPosterPayload(request.body ?? {});
        const result = await callCloudFunction('poster', {
            action: 'create',
            data: {
                ...payload,
                createdAt: new Date().toISOString(),
            },
            token: adminCloudFunctionToken,
        });
        if (!result.success) {
            response.status(400).json({ message: result.error });
            return;
        }
        const detail = await fetchAdminMiniPosterDetail(result.data.id);
        if (!detail.success) {
            response.status(400).json({ message: detail.error });
            return;
        }
        response.json(detail.data);
    }
    catch (error) {
        response.status(500).json({ message: error instanceof Error ? error.message : '创建海报失败' });
    }
});
adminMiniRouter.put('/posters/:id', async (request, response) => {
    try {
        const current = await fetchAdminMiniPosterDetail(String(request.params.id));
        if (!current.success) {
            response.status(404).json({ message: current.error });
            return;
        }
        const payload = buildPosterPayload(request.body ?? {}, current.data);
        const result = await callCloudFunction('poster', {
            action: 'update',
            id: String(request.params.id),
            data: payload,
            token: adminCloudFunctionToken,
        });
        if (!result.success) {
            response.status(400).json({ message: result.error });
            return;
        }
        const detail = await fetchAdminMiniPosterDetail(String(request.params.id));
        if (!detail.success) {
            response.status(400).json({ message: detail.error });
            return;
        }
        response.json(detail.data);
    }
    catch (error) {
        response.status(500).json({ message: error instanceof Error ? error.message : '更新海报失败' });
    }
});
adminMiniRouter.delete('/posters/:id', async (request, response) => {
    try {
        const result = await callCloudFunction('poster', {
            action: 'delete',
            id: String(request.params.id),
            token: adminCloudFunctionToken,
        });
        if (!result.success) {
            response.status(400).json({ message: result.error });
            return;
        }
        response.json({ success: true });
    }
    catch (error) {
        response.status(500).json({ message: error instanceof Error ? error.message : '删除海报失败' });
    }
});
adminMiniRouter.put('/posters/:id/status', async (request, response) => {
    try {
        const current = await fetchAdminMiniPosterDetail(String(request.params.id));
        if (!current.success) {
            response.status(404).json({ message: current.error });
            return;
        }
        const payload = buildPosterPayload({
            ...current.data,
            status: request.body?.status,
        }, current.data);
        const result = await callCloudFunction('poster', {
            action: 'update',
            id: String(request.params.id),
            data: payload,
            token: adminCloudFunctionToken,
        });
        if (!result.success) {
            response.status(400).json({ message: result.error });
            return;
        }
        const detail = await fetchAdminMiniPosterDetail(String(request.params.id));
        if (!detail.success) {
            response.status(400).json({ message: detail.error });
            return;
        }
        response.json(detail.data);
    }
    catch (error) {
        response.status(500).json({ message: error instanceof Error ? error.message : '更新海报状态失败' });
    }
});
adminMiniRouter.get('/site-config/current', (_request, response) => {
    response.json({ data: getSiteConfig() });
});
