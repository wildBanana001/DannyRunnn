import { Router } from 'express';
import { createRegistration, getRegistrationById, listRegistrationsByOpenid, } from '../data/registrations.js';
import { wxCloudrunAuth } from '../middlewares/wx-cloudrun-auth.js';
import { parsePage, paginate, requireWxOpenid } from './utils.js';
export const registrationRouter = Router();
registrationRouter.use(wxCloudrunAuth);
registrationRouter.get('/', (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid) {
        return;
    }
    const page = parsePage(request.query.page, 1);
    const pageSize = parsePage(request.query.pageSize, 20);
    const status = typeof request.query.status === 'string' ? request.query.status : undefined;
    const activityId = typeof request.query.activityId === 'string' ? request.query.activityId.trim() : undefined;
    const list = listRegistrationsByOpenid(openid, { activityId, status });
    response.json(paginate(list, page, pageSize));
});
registrationRouter.get('/:id', (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid) {
        return;
    }
    const registration = getRegistrationById(openid, String(request.params.id));
    if (!registration) {
        response.status(404).json({ message: '报名记录不存在' });
        return;
    }
    response.json(registration);
});
registrationRouter.post('/', (request, response) => {
    const openid = requireWxOpenid(request, response);
    if (!openid) {
        return;
    }
    try {
        const registration = createRegistration(openid, request.body ?? {});
        response.status(201).json(registration);
    }
    catch (error) {
        response.status(400).json({ message: error instanceof Error ? error.message : '创建报名失败' });
    }
});
