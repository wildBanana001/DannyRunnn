import { getAdminSession } from '../cloudClient.js';
function extractToken(request) {
    const authorization = request.header('authorization');
    const headerToken = request.header('x-admin-token');
    if (headerToken) {
        return headerToken.trim();
    }
    if (!authorization) {
        return '';
    }
    if (authorization.startsWith('Bearer ')) {
        return authorization.slice(7).trim();
    }
    return authorization.trim();
}
export function authMiddleware(request, response, next) {
    const token = extractToken(request);
    if (!token) {
        response.status(401).json({ message: '未提供管理端登录凭证' });
        return;
    }
    const session = getAdminSession(token);
    if (!session) {
        response.status(401).json({ message: '登录状态已失效，请重新登录' });
        return;
    }
    request.adminToken = token;
    request.adminUser = session.user;
    next();
}
export function resolveRequestToken(request) {
    return request.adminToken ?? extractToken(request);
}
