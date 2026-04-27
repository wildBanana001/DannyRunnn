export function parsePage(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
export function paginate(list, page, pageSize) {
    const startIndex = (page - 1) * pageSize;
    return {
        list: list.slice(startIndex, startIndex + pageSize),
        total: list.length,
    };
}
export function resolveWxOpenid(request) {
    return request.wxUser?.openid?.trim() || request.header('x-wx-openid')?.trim() || '';
}
export function requireWxOpenid(request, response) {
    const openid = resolveWxOpenid(request);
    if (!openid) {
        response.status(401).json({ message: '缺少微信身份信息' });
        return null;
    }
    return openid;
}
