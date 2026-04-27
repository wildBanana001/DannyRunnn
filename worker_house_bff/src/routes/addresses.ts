import { Router } from 'express';
import {
  createAddress,
  deleteAddress,
  getAddressesByOpenid,
  updateAddress,
} from '../data/addresses.js';
import { wxCloudrunAuth } from '../middlewares/wx-cloudrun-auth.js';
import { requireWxOpenid } from './utils.js';

export const addressRouter = Router();

addressRouter.use(wxCloudrunAuth);

addressRouter.get('/', (request, response) => {
  const openid = requireWxOpenid(request, response);
  if (!openid) {
    return;
  }
  const addresses = getAddressesByOpenid(openid);
  response.json(addresses);
});

addressRouter.post('/', (request, response) => {
  const openid = requireWxOpenid(request, response);
  if (!openid) {
    return;
  }

  try {
    const address = createAddress(openid, request.body ?? {});
    response.status(201).json(address);
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : '创建地址失败' });
  }
});

addressRouter.put('/:id', (request, response) => {
  const openid = requireWxOpenid(request, response);
  if (!openid) {
    return;
  }

  try {
    const address = updateAddress(openid, String(request.params.id), request.body ?? {});
    response.json(address);
  } catch (error) {
    response.status(404).json({ message: error instanceof Error ? error.message : '地址更新失败' });
  }
});

addressRouter.delete('/:id', (request, response) => {
  const openid = requireWxOpenid(request, response);
  if (!openid) {
    return;
  }

  try {
    deleteAddress(openid, String(request.params.id));
    response.json({ success: true });
  } catch (error) {
    response.status(404).json({ message: error instanceof Error ? error.message : '地址删除失败' });
  }
});
