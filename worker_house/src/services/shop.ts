import { cloudrunRequest } from './cloudrun';
import type { Order, Product } from '@/types/shop';

/** 从 BFF 拉取商品列表（cloudrun 模式） */
export async function fetchShopProducts(): Promise<Product[]> {
  const result = await cloudrunRequest<Product[] | { list: Product[] }>({
    path: '/api/shop/products',
    method: 'GET',
  });
  // 兼容 { list: [] } 与裸数组两种返回结构
  if (Array.isArray(result)) {
    return result;
  }
  return result?.list ?? [];
}

export interface CreateOrderPayload {
  productId: string;
  quantity: number;
  addressId?: string;
  remark?: string;
  totalAmount: number;
}

/** 提交订单并请求支付参数（cloudrun 模式） */
export async function payShopOrder(payload: CreateOrderPayload): Promise<{ order?: Order; payParams?: any }> {
  const result = await cloudrunRequest<{ order?: Order; payParams?: any }>({
    path: '/api/shop/orders/pay',
    method: 'POST',
    data: payload,
  });
  return result ?? {};
}
