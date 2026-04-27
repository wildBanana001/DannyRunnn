import { posts } from '@/data/posts';
import { currentUser } from '@/data/users';
import type { Post } from '@/types/post';
import { getApiMode, request } from './request';

interface ListResponse<T> {
  data?: T[];
  list?: T[];
  total: number;
}

const sortByCreatedDesc = (list: Post[]) => {
  return [...list].sort((prev, next) => new Date(next.createdAt).getTime() - new Date(prev.createdAt).getTime());
};

export async function fetchMyPosts(): Promise<Post[]> {
  if (getApiMode() === 'mock') {
    return sortByCreatedDesc(posts.filter((item) => item.authorId === currentUser.id));
  }

  const response = await request<ListResponse<Post>>({ path: '/api/posts/mine' });
  return sortByCreatedDesc(response.data ?? response.list ?? []);
}
