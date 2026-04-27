import request from '@/services/request';
import type { Poster } from '@/types/poster';

export interface PosterListParams {
  page: number;
  pageSize: number;
  enabled?: boolean;
}

interface PosterListResponse {
  list: Poster[];
  total: number;
}

export async function getPosterList(params: PosterListParams) {
  const { data } = await request.get<PosterListResponse>('/posters', { params });
  return data;
}

export async function getPosterDetail(id: string) {
  const { data } = await request.get<Poster>(`/posters/${id}`);
  return data;
}

export async function createPoster(payload: Omit<Poster, 'id' | 'createdAt' | 'updatedAt'>) {
  const { data } = await request.post<Poster>('/posters', payload);
  return data;
}

export async function updatePoster(id: string, payload: Poster) {
  const { data } = await request.put<Poster>(`/posters/${id}`, payload);
  return data;
}

export async function deletePoster(id: string) {
  const { data } = await request.delete<{ success: boolean }>(`/posters/${id}`);
  return data;
}

export async function reorderPosters(ids: string[]) {
  const { data } = await request.put<{ success: boolean }>('/posters/reorder', { ids });
  return data;
}
