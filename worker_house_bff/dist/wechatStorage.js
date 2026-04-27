import path from 'node:path';
import axios from 'axios';
import { assertWechatConfigReady, config } from './config.js';
let accessTokenCache = null;
function getErrorMessage(error) {
    if (axios.isAxiosError(error)) {
        const payload = error.response?.data;
        return payload?.errmsg || payload?.error || payload?.message || error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return '未知错误';
}
async function parseWechatResponse(response) {
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
        throw new Error(payload.errmsg || `HTTP ${response.status}`);
    }
    if (payload.errcode && payload.errcode !== 0) {
        throw new Error(payload.errmsg || `errcode=${payload.errcode}`);
    }
    return payload;
}
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
async function withRetry(label, executor, retries = 2) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await executor();
        }
        catch (error) {
            lastError = error;
            if (attempt === retries) {
                break;
            }
            await sleep((attempt + 1) * 500);
        }
    }
    throw new Error(`${label}失败：${getErrorMessage(lastError)}`);
}
function isTokenExpiredError(error) {
    if (!axios.isAxiosError(error)) {
        return false;
    }
    const payload = error.response?.data;
    return payload?.errcode === 40001 || payload?.errcode === 42001;
}
function sanitizeFileName(fileName) {
    const extension = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName, extension).replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-');
    const safeBaseName = baseName.replace(/^-|-$/g, '') || 'image';
    return `${safeBaseName}${extension || '.jpg'}`;
}
function getContentType(fileName, preferred) {
    if (preferred && preferred.trim()) {
        return preferred.trim();
    }
    const extension = path.extname(fileName).toLowerCase();
    if (extension === '.png') {
        return 'image/png';
    }
    if (extension === '.webp') {
        return 'image/webp';
    }
    if (extension === '.gif') {
        return 'image/gif';
    }
    return 'image/jpeg';
}
export function buildCloudStoragePath(scope, fileName) {
    const safeScope = scope.replace(/[^a-zA-Z0-9/_-]/g, '-').replace(/-+/g, '-').replace(/^\/+|\/+$/g, '') || 'uploads';
    return `worker-house/${safeScope}/${sanitizeFileName(fileName)}`;
}
async function requestWechatAccessToken(forceRefresh = false) {
    if (!forceRefresh && accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
        return accessTokenCache.token;
    }
    assertWechatConfigReady();
    return withRetry('获取微信 access_token', async () => {
        const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
        url.searchParams.set('appid', config.cloudAppId);
        url.searchParams.set('grant_type', 'client_credential');
        url.searchParams.set('secret', config.cloudAppSecret);
        const payload = await parseWechatResponse(await fetch(url, {
            method: 'GET',
        }));
        if (!payload.access_token) {
            throw new Error(payload.errmsg || '接口未返回 access_token');
        }
        accessTokenCache = {
            token: payload.access_token,
            expiresAt: Date.now() + Math.max((payload.expires_in ?? 7200) - 300, 60) * 1000,
        };
        return accessTokenCache.token;
    });
}
async function getAccessToken() {
    try {
        return await requestWechatAccessToken();
    }
    catch (error) {
        accessTokenCache = null;
        throw error;
    }
}
async function requestUploadTicket(cloudPath) {
    const accessToken = await getAccessToken();
    return withRetry('获取云存储上传凭证', async () => {
        const url = new URL('https://api.weixin.qq.com/tcb/uploadfile');
        url.searchParams.set('access_token', accessToken);
        const payload = await parseWechatResponse(await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                env: config.cloudEnvId,
                path: cloudPath,
            }),
        }));
        if (!payload.authorization || !payload.cos_file_id || !payload.file_id || !payload.token || !payload.url) {
            throw new Error('云存储上传凭证字段不完整');
        }
        return {
            authorization: payload.authorization,
            cosFileId: payload.cos_file_id,
            fileID: payload.file_id,
            token: payload.token,
            uploadUrl: payload.url,
        };
    });
}
async function uploadFileToCos(cloudPath, ticket, source) {
    return withRetry('上传文件到云存储', async () => {
        const form = new FormData();
        form.append('key', cloudPath);
        form.append('Signature', ticket.authorization);
        form.append('x-cos-security-token', ticket.token);
        form.append('x-cos-meta-fileid', ticket.cosFileId);
        form.append('file', new Blob([new Uint8Array(source.buffer)], {
            type: getContentType(source.fileName, source.contentType),
        }), source.fileName);
        const response = await fetch(ticket.uploadUrl, {
            method: 'POST',
            body: form,
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
    });
}
async function getDownloadUrl(fileID, maxAge = 31536000) {
    const accessToken = await getAccessToken();
    return withRetry('获取文件下载链接', async () => {
        const url = new URL('https://api.weixin.qq.com/tcb/batchdownloadfile');
        url.searchParams.set('access_token', accessToken);
        const payload = await parseWechatResponse(await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                env: config.cloudEnvId,
                file_list: [{ fileid: fileID, max_age: maxAge }],
            }),
        }));
        const file = payload.file_list?.[0];
        if (!file || file.status !== 0 || !file.download_url) {
            throw new Error(file?.errmsg || '未获取到 download_url');
        }
        return file.download_url;
    });
}
export async function uploadToWechatCloudStorage(source, cloudPath = buildCloudStoragePath('admin', source.fileName)) {
    const safeFileName = sanitizeFileName(source.fileName);
    const normalizedSource = {
        ...source,
        contentType: getContentType(safeFileName, source.contentType),
        fileName: safeFileName,
        size: source.size || source.buffer.byteLength,
    };
    const ticket = await requestUploadTicket(cloudPath);
    await uploadFileToCos(cloudPath, ticket, normalizedSource);
    const url = await getDownloadUrl(ticket.fileID);
    return {
        fileID: ticket.fileID,
        name: safeFileName,
        size: normalizedSource.size,
        url,
    };
}
