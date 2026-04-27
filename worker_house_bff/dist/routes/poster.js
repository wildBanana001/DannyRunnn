import { Router } from 'express';
import { callCloudFunction, normalizePoster } from '../cloudClient.js';
import { authMiddleware, resolveRequestToken } from '../middleware/auth.js';
function parseBoolean(value) {
    if (value === 'true' || value === true) {
        return true;
    }
    if (value === 'false' || value === false) {
        return false;
    }
    return undefined;
}
function parsePage(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
async function fetchPosterDetail(id) {
    const detailResult = await callCloudFunction('poster', {
        action: 'get',
        id,
    });
    if (!detailResult.success) {
        return detailResult;
    }
    const poster = normalizePoster(detailResult.data);
    if (!poster) {
        return { success: false, error: '海报不存在' };
    }
    return { success: true, data: poster };
}
export const posterRouter = Router();
posterRouter.put('/reorder', authMiddleware, async (request, response) => {
    const ids = Array.isArray(request.body?.ids) ? request.body.ids.map((item) => String(item)) : [];
    try {
        const result = await callCloudFunction('poster', {
            action: 'reorder',
            ids,
            token: resolveRequestToken(request),
        });
        if (!result.success) {
            response.status(400).json({ message: result.error });
            return;
        }
        response.json({ success: true });
    }
    catch (error) {
        response.status(500).json({ message: error instanceof Error ? error.message : '海报排序失败' });
    }
});
posterRouter.get('/', async (request, response) => {
    const page = parsePage(request.query.page, 1);
    const pageSize = parsePage(request.query.pageSize, 10);
    const enabled = parseBoolean(request.query.enabled);
    try {
        const result = await callCloudFunction('poster', {
            action: 'list',
        });
        if (!result.success) {
            response.status(400).json({ message: result.error });
            return;
        }
        let list = result.data
            .map((item) => normalizePoster(item))
            .filter((item) => Boolean(item));
        if (enabled !== undefined) {
            list = list.filter((item) => item.enabled === enabled);
        }
        list = list.sort((first, second) => {
            if (first.sort !== second.sort) {
                return first.sort - second.sort;
            }
            return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
        });
        const startIndex = (page - 1) * pageSize;
        response.json({
            list: list.slice(startIndex, startIndex + pageSize),
            total: list.length,
        });
    }
    catch (error) {
        response.status(500).json({ message: error instanceof Error ? error.message : '获取海报列表失败' });
    }
});
posterRouter.post('/', authMiddleware, async (request, response) => {
    try {
        const result = await callCloudFunction('poster', {
            action: 'create',
            data: request.body,
            token: resolveRequestToken(request),
        });
        if (!result.success) {
            response.status(400).json({ message: result.error });
            return;
        }
        const detail = await fetchPosterDetail(result.data.id);
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
posterRouter.get('/:id', async (request, response) => {
    try {
        const result = await fetchPosterDetail(String(request.params.id));
        if (!result.success) {
            response.status(404).json({ message: result.error });
            return;
        }
        response.json(result.data);
    }
    catch (error) {
        response.status(500).json({ message: error instanceof Error ? error.message : '获取海报详情失败' });
    }
});
posterRouter.put('/:id', authMiddleware, async (request, response) => {
    try {
        const result = await callCloudFunction('poster', {
            action: 'update',
            data: request.body,
            id: String(request.params.id),
            token: resolveRequestToken(request),
        });
        if (!result.success) {
            response.status(400).json({ message: result.error });
            return;
        }
        const detail = await fetchPosterDetail(String(request.params.id));
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
posterRouter.delete('/:id', authMiddleware, async (request, response) => {
    try {
        const result = await callCloudFunction('poster', {
            action: 'delete',
            id: String(request.params.id),
            token: resolveRequestToken(request),
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
