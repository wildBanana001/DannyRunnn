import request from '@/services/request';
import type { Post } from '@/types/post';

export interface PostListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  onlyPinned?: boolean;
  colors?: string;
}

interface PostListResponse {
  list: Post[];
  total: number;
}

export async function getPostList(params: PostListParams) {
  const { data } = await request.get<PostListResponse>('/posts', { params });
  return data;
}

export async function deletePost(id: string) {
  const { data } = await request.delete<{ success: boolean }>(`/posts/${id}`);
  return data;
}

export async function updatePostPinned(id: string, isPinned: boolean) {
  const { data } = await request.patch<Post>(`/posts/${id}/pin`, { isPinned });
  return data;
}
