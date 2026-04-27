import { config } from '../config.js';
const MOCK_WX_OPENID = 'mock_openid_001';
export const wxCloudrunAuth = (request, response, next) => {
    const openid = request.header('x-wx-openid')?.trim();
    const unionid = request.header('x-wx-unionid')?.trim();
    if (config.cloudMode === 'mock') {
        request.wxUser = {
            appid: request.header('x-wx-appid')?.trim() || 'mock-appid',
            fromOpenid: request.header('x-wx-from-openid')?.trim() || undefined,
            openid: openid || MOCK_WX_OPENID,
            source: request.header('x-wx-source')?.trim() || 'mock',
            unionid: unionid || undefined,
        };
        next();
        return;
    }
    if (config.cloudMode === 'cloudrun' && !openid) {
        response.status(401).json({ code: 401, message: '缺少微信身份信息' });
        return;
    }
    request.wxUser = {
        appid: request.header('x-wx-appid')?.trim() || undefined,
        fromOpenid: request.header('x-wx-from-openid')?.trim() || undefined,
        openid: openid || undefined,
        source: request.header('x-wx-source')?.trim() || undefined,
        unionid: unionid || undefined,
    };
    next();
};
