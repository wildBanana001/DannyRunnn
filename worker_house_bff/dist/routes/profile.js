import { Router } from 'express';
import { createProfile, deleteProfile, getProfileById, listProfilesByOpenid, setDefaultProfile, updateProfile, } from '../data/profiles.js';
import { wxCloudrunAuth } from '../middlewares/wx-cloudrun-auth.js';
import { parsePage, paginate, requireWxOpenid } from './utils.js';
export const profileRouter = Router();
profileRouter.use(wxCloudrunAuth);
profileRouter.get('/', (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid) {
        return;
    }
    const page = parsePage(request.query.page, 1);
    const pageSize = parsePage(request.query.pageSize, 20);
    const profiles = listProfilesByOpenid(openid);
    response.json(paginate(profiles, page, pageSize));
});
profileRouter.get('/:id', (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid) {
        return;
    }
    const profile = getProfileById(openid, String(request.params.id));
    if (!profile) {
        response.status(404).json({ message: '用户档案不存在' });
        return;
    }
    response.json(profile);
});
profileRouter.post('/', (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid) {
        return;
    }
    try {
        const profile = createProfile(openid, request.body ?? {});
        response.status(201).json(profile);
    }
    catch (error) {
        response.status(400).json({ message: error instanceof Error ? error.message : '创建用户档案失败' });
    }
});
profileRouter.put('/', (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid) {
        return;
    }
    const profileId = String(request.body?.id ?? '').trim();
    if (!profileId) {
        response.status(400).json({ message: '缺少用户档案 ID' });
        return;
    }
    const profile = updateProfile(openid, profileId, request.body ?? {});
    if (!profile) {
        response.status(404).json({ message: '用户档案不存在' });
        return;
    }
    response.json(profile);
});
profileRouter.put('/:id/default', (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid) {
        return;
    }
    const profile = setDefaultProfile(openid, String(request.params.id));
    if (!profile) {
        response.status(404).json({ message: '用户档案不存在' });
        return;
    }
    response.json(profile);
});
profileRouter.put('/:id', (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid) {
        return;
    }
    const profile = updateProfile(openid, String(request.params.id), request.body ?? {});
    if (!profile) {
        response.status(404).json({ message: '用户档案不存在' });
        return;
    }
    response.json(profile);
});
profileRouter.delete('/', (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid) {
        return;
    }
    const profileId = String(request.body?.id ?? request.query.id ?? '').trim();
    if (!profileId) {
        response.status(400).json({ message: '缺少用户档案 ID' });
        return;
    }
    const deleted = deleteProfile(openid, profileId);
    if (!deleted) {
        response.status(404).json({ message: '用户档案不存在' });
        return;
    }
    response.json({ success: true });
});
profileRouter.delete('/:id', (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid) {
        return;
    }
    const deleted = deleteProfile(openid, String(request.params.id));
    if (!deleted) {
        response.status(404).json({ message: '用户档案不存在' });
        return;
    }
    response.json({ success: true });
});
