import request from '@/services/request';
import type { Activity } from '@/types/activity';

export interface ActivityListParams {
  page: number;
  pageSize: number;
  status?: Activity['status'];
  keyword?: string;
}

interface ActivityListResponse {
  list: Activity[];
  total: number;
}

export async function getActivityList(params: ActivityListParams) {
  const { data } = await request.get<ActivityListResponse>('/activities', { params });
  return data;
}

export async function getActivityDetail(id: string) {
  const { data } = await request.get<Activity>(`/activities/${id}`);
  return data;
}

export async function createActivity(payload: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>) {
  const { data } = await request.post<Activity>('/activities', payload);
  return data;
}

export async function updateActivity(id: string, payload: Activity) {
  const { data } = await request.put<Activity>(`/activities/${id}`, payload);
  return data;
}

export async function deleteActivity(id: string) {
  const { data } = await request.delete<{ success: boolean }>(`/activities/${id}`);
  return data;
}
