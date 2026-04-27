import { Router } from 'express';
import { callCloudFunction, normalizeSiteConfig, toCloudSiteConfigPayload, } from '../cloudClient.js';
import { authMiddleware, resolveRequestToken } from '../middleware/auth.js';
async function fetchSiteConfig() {
    const result = await callCloudFunction('site_config', {
        action: 'get',
    });
    if (!result.success) {
        return result;
    }
    return {
        success: true,
        data: normalizeSiteConfig(result.data ?? null),
    };
}
export const siteRouter = Router();
siteRouter.get('/config', async (_request, response) => {
    try {
        const result = await fetchSiteConfig();
        if (!result.success) {
            response.status(400).json({ message: result.error });
            return;
        }
        response.json(result.data);
    }
    catch (error) {
        response.status(500).json({ message: error instanceof Error ? error.message : '获取站点配置失败' });
    }
});
siteRouter.put('/config', authMiddleware, async (request, response) => {
    try {
        const payload = normalizeSiteConfig(request.body);
        const result = await callCloudFunction('site_config', {
            action: 'update',
            data: toCloudSiteConfigPayload(payload),
            token: resolveRequestToken(request),
        });
        if (!result.success) {
            response.status(400).json({ message: result.error });
            return;
        }
        const latest = await fetchSiteConfig();
        if (!latest.success) {
            response.status(400).json({ message: latest.error });
            return;
        }
        response.json(latest.data);
    }
    catch (error) {
        response.status(500).json({ message: error instanceof Error ? error.message : '更新站点配置失败' });
    }
});
