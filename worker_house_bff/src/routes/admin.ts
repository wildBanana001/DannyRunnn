import { Router } from 'express';
import { listAllCardOrders } from '../data/cardOrders.js';
import { listAllRegistrations } from '../data/registrations.js';
import { authMiddleware } from '../middleware/auth.js';
import type { RegistrationStatus } from '../types/index.js';
import { parsePage, paginate } from './utils.js';

export const adminRouter = Router();

adminRouter.use(authMiddleware);

adminRouter.get('/registrations', (request, response) => {
  const page = parsePage(request.query.page, 1);
  const pageSize = parsePage(request.query.pageSize, 20);
  const status = typeof request.query.status === 'string' ? (request.query.status as RegistrationStatus) : undefined;
  const activityId = typeof request.query.activityId === 'string' ? request.query.activityId.trim() : undefined;
  const openid = typeof request.query.openid === 'string' ? request.query.openid.trim() : undefined;

  let list = listAllRegistrations({ activityId, status });
  if (openid) {
    list = list.filter((item) => item.openid === openid);
  }

  response.json(paginate(list, page, pageSize));
});

adminRouter.get('/card-orders', (request, response) => {
  const page = parsePage(request.query.page, 1);
  const pageSize = parsePage(request.query.pageSize, 20);
  const openid = typeof request.query.openid === 'string' ? request.query.openid.trim() : undefined;
  const status = typeof request.query.status === 'string' ? request.query.status.trim() : undefined;

  let list = listAllCardOrders();
  if (openid) {
    list = list.filter((item) => item.openid === openid);
  }
  if (status) {
    list = list.filter((item) => item.status === status);
  }

  response.json(paginate(list, page, pageSize));
});
