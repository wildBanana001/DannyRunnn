import { config } from '../config.js';
const MOCK_WX_OPENID = 'mock_openid_001';
export const wxCloudrunAuth = (request, response, next) => {
    const openid = request.header('x-wx-openid')?.trim();
    const unionid = request.header('x-wx-unionid')?.trim();
    const appid = request.header('x-wx-appid')?.trim();
    if (config.cloudMode === 'mock') {
        request.wxUser = {
            appid: appid || 'mock-appid',
            fromOpenid: request.header('x-wx-from-openid')?.trim() || undefined,
            openid: openid || MOCK_WX_OPENID,
            source: request.header('x-wx-source')?.trim() || 'mock',
            unionid: unionid || undefined,
        };
        next();
        return;
    }
    if (config.cloudMode === 'wechat') {
        response.status(503).json({
            code: 503,
            message: '传统 BFF 模式尚未接入服务端微信会话，用户身份接口已安全停用',
        });
        return;
    }
    if (!openid) {
        response.status(401).json({ code: 401, message: '缺少微信身份信息' });
        return;
    }
    const expectedAppid = config.wechatPay.appId || config.cloudAppId;
    if (config.cloudMode === 'cloudrun' && expectedAppid && appid !== expectedAppid) {
        response.status(401).json({ code: 401, message: '微信 AppID 不匹配' });
        return;
    }
    request.wxUser = {
        appid: appid || undefined,
        fromOpenid: request.header('x-wx-from-openid')?.trim() || undefined,
        openid: openid || undefined,
        source: request.header('x-wx-source')?.trim() || undefined,
        unionid: unionid || undefined,
    };
    next();
};
export const wxPaymentAuth = (request, response, next) => {
    wxCloudrunAuth(request, response, next);
};
