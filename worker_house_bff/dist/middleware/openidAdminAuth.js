import { isOpenidAdmin } from '../config/adminWhitelist.js';
export function resolveAdminOpenid(request) {
    return request.header('x-wx-openid')?.trim() || '';
}
export function openidAdminAuth(request, response, next) {
    const openid = resolveAdminOpenid(request);
    if (!openid) {
        response.status(401).json({ message: '缺少微信身份信息' });
        return;
    }
    if (!isOpenidAdmin(openid)) {
        response.status(401).json({ message: '你不是管理员', openid });
        return;
    }
    request.adminOpenid = openid;
    next();
}
