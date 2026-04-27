import { getApiMode, request } from './request';
import type { Story } from '@/types';

interface StoryListResponse {
  list: Story[];
  total: number;
}

export async function fetchStories(limit = 3): Promise<Story[]> {
  if (getApiMode() === 'mock') {
    return [];
  }

  const response = await request<StoryListResponse>({
    path: `/api/stories?limit=${encodeURIComponent(String(limit))}`,
  });
  return Array.isArray(response.list) ? response.list : [];
}

export async function fetchStoryDetail(id: string): Promise<Story | null> {
  if (getApiMode() === 'mock') {
    return null;
  }

  return request<Story>({
    path: `/api/stories/${encodeURIComponent(id)}`,
  });
}
