import axios from 'axios';
import { assertWechatConfigReady, config } from './config.js';
import { mockStore } from './mock/store.js';
const adminSessions = new Map();
let accessTokenCache = null;
function fail(error) {
    return { success: false, error };
}
function success(data) {
    return { success: true, data };
}
function parseRespData(value) {
    if (typeof value !== 'string') {
        return value;
    }
    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
}
async function getWechatAccessToken() {
    if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
        return accessTokenCache.token;
    }
    assertWechatConfigReady();
    const response = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
        params: {
            appid: config.cloudAppId,
            grant_type: 'client_credential',
            secret: config.cloudAppSecret,
        },
        timeout: 10000,
    });
    const payload = response.data;
    if (!payload.access_token) {
        throw new Error(payload.errmsg || '获取微信 access_token 失败');
    }
    accessTokenCache = {
        token: payload.access_token,
        expiresAt: Date.now() + Math.max((payload.expires_in ?? 7200) - 300, 60) * 1000,
    };
    return accessTokenCache.token;
}
async function invokeWechatCloudFunction(name, event) {
    const accessToken = await getWechatAccessToken();
    const response = await axios.post('https://api.weixin.qq.com/tcb/invokecloudfunction', event, {
        params: {
            access_token: accessToken,
            env: config.cloudEnvId,
            name,
        },
        headers: {
            'Content-Type': 'application/json',
        },
        timeout: 10000,
    });
    const payload = response.data;
    if (payload.errcode !== 0) {
        return fail(payload.errmsg || `微信云函数调用失败（${payload.errcode ?? 'unknown'}）`);
    }
    const parsed = parseRespData(payload.resp_data);
    if (parsed && typeof parsed === 'object' && 'success' in parsed) {
        return parsed;
    }
    return success(parsed);
}
function toAuthUserFromAdmin(admin) {
    return {
        id: admin.id,
        name: admin.name,
        role: admin.role,
        username: admin.username,
    };
}
function createFallbackAdminUser(token) {
    return {
        id: `admin-${token.slice(0, 8) || 'token'}`,
        name: '管理员',
        role: 'admin',
        username: 'admin',
    };
}
function getMockAdminUserByToken(token) {
    const admin = mockStore.getAdminByToken(token);
    return admin ? toAuthUserFromAdmin(admin) : null;
}
function registerAdminSession(token, user) {
    adminSessions.set(token, { token, user });
}
export function getAdminSession(token) {
    if (!token) {
        return null;
    }
    if (token === config.adminToken || token === 'admin-token') {
        return {
            token,
            user: adminSessions.get(token)?.user ?? getMockAdminUserByToken(token) ?? createFallbackAdminUser(token),
        };
    }
    const session = adminSessions.get(token);
    if (session) {
        return session;
    }
    const mockUser = getMockAdminUserByToken(token);
    if (mockUser) {
        return { token, user: mockUser };
    }
    return null;
}
export function destroyAdminSession(token) {
    if (token && token !== config.adminToken) {
        adminSessions.delete(token);
    }
}
export function normalizePoster(record) {
    if (!record) {
        return null;
    }
    return {
        id: String(record.id ?? record._id ?? ''),
        title: String(record.title ?? ''),
        coverImage: String(record.coverImage ?? ''),
        detailImages: Array.isArray(record.detailImages)
            ? record.detailImages.map((item) => String(item))
            : [],
        enabled: Boolean(record.enabled),
        sort: Number(record.sort ?? 0),
        createdAt: String(record.createdAt ?? new Date().toISOString()),
        updatedAt: String(record.updatedAt ?? record.createdAt ?? new Date().toISOString()),
    };
}
export function normalizeActivity(record) {
    if (!record) {
        return null;
    }
    const gallery = Array.isArray(record.gallery)
        ? record.gallery.map((item) => String(item))
        : Array.isArray(record.covers)
            ? record.covers.map((item) => String(item))
            : [];
    const coverImage = String(record.coverImage ?? record.cover ?? gallery[0] ?? '');
    const cover = String(record.cover ?? coverImage ?? gallery[0] ?? '');
    const covers = Array.from(new Set([cover, coverImage, ...(Array.isArray(record.covers) ? record.covers.map((item) => String(item)) : []), ...gallery]
        .map((item) => String(item).trim())
        .filter(Boolean)));
    return {
        id: String(record.id ?? record._id ?? ''),
        title: String(record.title ?? ''),
        description: String(record.description ?? ''),
        fullDescription: String(record.fullDescription ?? ''),
        cover,
        coverImage: coverImage || cover,
        covers,
        gallery: gallery.length ? gallery : covers,
        startDate: String(record.startDate ?? ''),
        endDate: String(record.endDate ?? ''),
        startTime: String(record.startTime ?? ''),
        endTime: String(record.endTime ?? ''),
        location: String(record.location ?? ''),
        address: String(record.address ?? ''),
        price: Number(record.price ?? 0),
        originalPrice: record.originalPrice === undefined || record.originalPrice === null
            ? undefined
            : Number(record.originalPrice),
        maxParticipants: Number(record.maxParticipants ?? 0),
        currentParticipants: Number(record.currentParticipants ?? 0),
        status: record.status ?? 'upcoming',
        category: String(record.category ?? ''),
        tags: Array.isArray(record.tags) ? record.tags.map((item) => String(item)) : [],
        cardEligible: Boolean(record.cardEligible),
        hostId: String(record.hostId ?? ''),
        hostName: String(record.hostName ?? ''),
        hostAvatar: String(record.hostAvatar ?? ''),
        hostDescription: String(record.hostDescription ?? ''),
        venueName: String(record.venueName ?? ''),
        venueDescription: String(record.venueDescription ?? ''),
        venueImages: Array.isArray(record.venueImages)
            ? record.venueImages.map((item) => String(item))
            : [],
        requirements: Array.isArray(record.requirements)
            ? record.requirements.map((item) => String(item))
            : [],
        includes: Array.isArray(record.includes) ? record.includes.map((item) => String(item)) : [],
        refundPolicy: String(record.refundPolicy ?? ''),
        signups: Array.isArray(record.signups)
            ? record.signups
            : [],
        createdAt: String(record.createdAt ?? new Date().toISOString()),
        updatedAt: String(record.updatedAt ?? record.createdAt ?? new Date().toISOString()),
    };
}
export function normalizePost(record) {
    if (!record) {
        return null;
    }
    const pinned = Boolean(record.isPinned ?? record.pinned);
    const commentsCount = Number(record.comments ?? record.commentsCount ?? 0);
    return {
        id: String(record.id ?? record._id ?? ''),
        authorId: String(record.authorId ?? ''),
        authorNickname: String(record.authorNickname ?? '匿名用户'),
        authorAvatar: record.authorAvatar ? String(record.authorAvatar) : undefined,
        title: String(record.title ?? record.content ?? '').trim().slice(0, 18) || '未命名留言',
        content: String(record.content ?? ''),
        images: Array.isArray(record.images) ? record.images.map((item) => String(item)) : [],
        likes: Number(record.likes ?? 0),
        comments: commentsCount,
        commentsCount,
        isLiked: Boolean(record.isLiked),
        isAnonymous: Boolean(record.isAnonymous),
        tags: Array.isArray(record.tags) ? record.tags.map((item) => String(item)) : [],
        color: record.color,
        isPinned: pinned,
        pinned,
        createdAt: String(record.createdAt ?? new Date().toISOString()),
        updatedAt: String(record.updatedAt ?? record.createdAt ?? new Date().toISOString()),
    };
}
export function normalizeComment(record) {
    if (!record) {
        return null;
    }
    return {
        id: String(record.id ?? record._id ?? ''),
        postId: String(record.postId ?? ''),
        authorId: String(record.authorId ?? ''),
        authorNickname: String(record.authorNickname ?? '匿名用户'),
        authorAvatar: record.authorAvatar ? String(record.authorAvatar) : undefined,
        content: String(record.content ?? ''),
        likes: Number(record.likes ?? 0),
        isLiked: Boolean(record.isLiked),
        isAnonymous: Boolean(record.isAnonymous),
        parentId: record.parentId ? String(record.parentId) : undefined,
        createdAt: String(record.createdAt ?? new Date().toISOString()),
        updatedAt: String(record.updatedAt ?? record.createdAt ?? new Date().toISOString()),
    };
}
export function normalizeSiteConfig(record) {
    return {
        ownerName: String(record?.ownerName ?? ''),
        ownerAvatar: String(record?.ownerAvatar ?? ''),
        ownerBio: String(record?.ownerBio ?? ''),
        spaceImage: String(record?.spaceImage ?? ''),
        spaceDescription: String(record?.spaceDescription ?? ''),
        videoFinderUserName: String(record?.videoFinderUserName ?? record?.finderUserName ?? ''),
        videoFeedId: String(record?.videoFeedId ?? record?.videoLink ?? ''),
        videoCover: String(record?.videoCover ?? ''),
        videoTitle: String(record?.videoTitle ?? ''),
        finderUserName: String(record?.finderUserName ?? record?.videoFinderUserName ?? ''),
        videoLink: String(record?.videoLink ?? record?.videoFeedId ?? ''),
    };
}
export function toCloudSiteConfigPayload(data) {
    return {
        ...data,
        finderUserName: data.videoFinderUserName,
        videoFinderUserName: data.videoFinderUserName,
        videoFeedId: data.videoFeedId,
        videoLink: data.videoFeedId,
        videoTitle: data.videoTitle,
    };
}
function invokeMockCloudFunction(name, event) {
    switch (name) {
        case 'admin_auth': {
            if (event.action !== 'login') {
                return fail('仅支持 login');
            }
            const admin = mockStore.loginAdmin(String(event.username ?? ''), String(event.password ?? ''));
            if (!admin) {
                return fail('账号或密码错误');
            }
            return success({ token: admin.token, username: admin.username });
        }
        case 'poster': {
            const action = event.action;
            if (action === 'list') {
                const enabled = event.enabled;
                const records = mockStore.listPosters().filter((item) => {
                    if (enabled === true) {
                        return item.enabled;
                    }
                    if (enabled === false) {
                        return !item.enabled;
                    }
                    return true;
                });
                return success(records);
            }
            if (action === 'get') {
                const record = mockStore.getPoster(String(event.id ?? ''));
                return record ? success(record) : fail('海报不存在');
            }
            if (action === 'create') {
                const record = mockStore.createPoster(event.data);
                return success({ id: record.id });
            }
            if (action === 'update') {
                const record = mockStore.updatePoster(String(event.id ?? ''), event.data);
                return record ? success({ id: record.id }) : fail('海报不存在');
            }
            if (action === 'delete') {
                const deleted = mockStore.deletePoster(String(event.id ?? ''));
                return deleted ? success({ id: event.id }) : fail('海报不存在');
            }
            if (action === 'reorder') {
                mockStore.reorderPosters(Array.isArray(event.ids) ? event.ids : []);
                return success({ success: true });
            }
            return fail(`不支持的 action: ${String(action)}`);
        }
        case 'activity': {
            const action = event.action;
            if (action === 'list') {
                return success(mockStore.listActivities());
            }
            if (action === 'get') {
                const record = mockStore.getActivity(String(event.id ?? ''));
                return record ? success(record) : fail('活动不存在');
            }
            if (action === 'signup') {
                const activityId = String(event.id ?? event.activityId ?? '');
                const record = mockStore.signupActivity(activityId, {
                    nickname: String(event.nickname ?? ''),
                    phone: String(event.phone ?? ''),
                    wechatId: String(event.wechatId ?? ''),
                });
                return record ? success({ id: record.id }) : fail('活动不存在');
            }
            if (action === 'create') {
                const record = mockStore.createActivity(event.data);
                return success({ id: record.id });
            }
            if (action === 'update') {
                const record = mockStore.updateActivity(String(event.id ?? ''), event.data);
                return record ? success({ id: record.id }) : fail('活动不存在');
            }
            if (action === 'delete') {
                const deleted = mockStore.deleteActivity(String(event.id ?? ''));
                return deleted ? success({ id: event.id }) : fail('活动不存在');
            }
            return fail(`不支持的 action: ${String(action)}`);
        }
        case 'post': {
            const action = event.action;
            if (action === 'list') {
                return success(mockStore.listPosts());
            }
            if (action === 'get') {
                const post = mockStore.getPost(String(event.id ?? ''));
                if (!post) {
                    return fail('帖子不存在');
                }
                return success({ post, comments: mockStore.getPostComments(post.id) });
            }
            if (action === 'create') {
                const rawData = event.data ?? {
                    authorAvatar: event.authorAvatar ? String(event.authorAvatar) : undefined,
                    authorId: event.authorId ? String(event.authorId) : undefined,
                    authorNickname: event.authorNickname ? String(event.authorNickname) : undefined,
                    color: event.color,
                    title: event.title ? String(event.title) : '',
                    content: event.content ? String(event.content) : '',
                    images: Array.isArray(event.images) ? event.images.map((item) => String(item)) : undefined,
                    isAnonymous: Boolean(event.isAnonymous),
                    tags: Array.isArray(event.tags) ? event.tags.map((item) => String(item)) : undefined,
                };
                const content = String(rawData.content ?? event.content ?? '');
                if (!content.trim()) {
                    return fail('留言内容不能为空');
                }
                const record = mockStore.createPost({ ...rawData, content });
                return success({ id: record.id });
            }
            if (action === 'delete') {
                const deleted = mockStore.deletePost(String(event.id ?? ''));
                return deleted ? success({ id: event.id }) : fail('帖子不存在');
            }
            if (action === 'pin') {
                const record = mockStore.pinPost(String(event.id ?? ''), Boolean(event.isPinned ?? event.pinned));
                return record ? success({ id: record.id }) : fail('帖子不存在');
            }
            if (action === 'like') {
                const record = mockStore.likePost(String(event.id ?? ''), Number(event.delta ?? 1));
                return record ? success(record) : fail('帖子不存在');
            }
            if (action === 'comment') {
                const postId = String(event.id ?? '');
                const content = String(event.content ?? '');
                if (!postId || !content.trim()) {
                    return fail('评论参数不完整');
                }
                const comment = mockStore.commentPost(postId, {
                    authorId: String(event.authorId ?? 'admin-user'),
                    authorNickname: String(event.authorNickname ?? '管理员'),
                    authorAvatar: event.authorAvatar ? String(event.authorAvatar) : undefined,
                    content,
                    isAnonymous: Boolean(event.isAnonymous),
                    parentId: event.parentId ? String(event.parentId) : undefined,
                });
                return comment ? success(comment) : fail('帖子不存在');
            }
            return fail(`不支持的 action: ${String(action)}`);
        }
        case 'site_config': {
            const action = event.action;
            if (action === 'get') {
                return success(mockStore.getSiteConfig());
            }
            if (action === 'update') {
                mockStore.updateSiteConfig(normalizeSiteConfig(event.data));
                return success({ id: 'site-config' });
            }
            return fail(`不支持的 action: ${String(action)}`);
        }
        default:
            return fail(`不支持的云函数: ${name}`);
    }
}
export async function callCloudFunction(name, event) {
    if (config.cloudMode === 'wechat') {
        return invokeWechatCloudFunction(name, event);
    }
    if (config.cloudMode === 'cloudrun') {
        // TODO: 云托管真实部署完成后，接入 @cloudbase/node-sdk 并直连云开发数据库。
        return invokeMockCloudFunction(name, event);
    }
    return invokeMockCloudFunction(name, event);
}
export async function loginAdmin(username, password) {
    const result = await callCloudFunction('admin_auth', {
        action: 'login',
        password,
        username,
    });
    if (!result.success) {
        return result;
    }
    const user = {
        id: `admin-${result.data.username}`,
        name: result.data.username === 'admin' ? '管理员' : result.data.username,
        role: 'admin',
        username: result.data.username,
    };
    registerAdminSession(result.data.token, user);
    return success({ token: result.data.token, user });
}
