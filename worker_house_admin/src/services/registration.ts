import request from '@/services/request';
import type { Registration } from '@/types';

export interface RegistrationListParams {
  activityId?: string;
  page: number;
  pageSize: number;
  status?: Registration['status'];
}

interface RegistrationListResponse {
  list: Registration[];
  total: number;
}

export async function getRegistrationList(params: RegistrationListParams) {
  const { data } = await request.get<RegistrationListResponse>('/admin/registrations', { params });
  return data;
}
