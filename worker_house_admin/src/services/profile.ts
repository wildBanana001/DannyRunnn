import request from '@/services/request';
import type { Profile } from '@/types';

export interface ProfileListParams {
  page: number;
  pageSize: number;
}

interface ProfileListResponse {
  list: Profile[];
  total: number;
}

export async function getProfileList(params: ProfileListParams) {
  const { data } = await request.get<ProfileListResponse>('/profiles', { params });
  return data;
}
