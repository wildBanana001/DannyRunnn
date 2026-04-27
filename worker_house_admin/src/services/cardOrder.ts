import request from '@/services/request';
import type { CardOrder } from '@/types';

export interface CardOrderListParams {
  page: number;
  pageSize: number;
}

interface CardOrderListResponse {
  list: CardOrder[];
  total: number;
}

export async function getCardOrderList(params: CardOrderListParams) {
  const { data } = await request.get<CardOrderListResponse>('/admin/card-orders', { params });
  return data;
}
