import { Router } from 'express';
import {
  getCardOrderById,
  getUsageLogsByCardOrderId,
  listCardOrdersByOpenid,
} from '../data/cardOrders.js';
import { wxCloudrunAuth } from '../middlewares/wx-cloudrun-auth.js';
import { rejectCardPurchase } from './card-purchase-unavailable.js';
import { parsePage, paginate, requireWxOpenid } from './utils.js';

export const cardOrderRouter = Router();

cardOrderRouter.use(wxCloudrunAuth);

cardOrderRouter.get('/', (request, response) => {
  const openid = requireWxOpenid(request, response);
  if (!openid) {
    return;
  }

  const page = parsePage(request.query.page, 1);
  const pageSize = parsePage(request.query.pageSize, 20);
  const list = listCardOrdersByOpenid(openid);

  response.json(paginate(list, page, pageSize));
});

cardOrderRouter.get('/:id/usage-logs', (request, response) => {
  const openid = requireWxOpenid(request, response);
  if (!openid) {
    return;
  }

  const usageLogs = getUsageLogsByCardOrderId(openid, String(request.params.id));
  if (!usageLogs) {
    response.status(404).json({ message: '次卡订单不存在' });
    return;
  }

  response.json({ list: usageLogs, total: usageLogs.length });
});

cardOrderRouter.get('/:id', (request, response) => {
  const openid = requireWxOpenid(request, response);
  if (!openid) {
    return;
  }

  const order = getCardOrderById(openid, String(request.params.id));
  if (!order) {
    response.status(404).json({ message: '次卡订单不存在' });
    return;
  }

  response.json(order);
});

cardOrderRouter.post('/', rejectCardPurchase);
