export type PostColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'purple';

export interface Post {
  id: string;
  _id?: string;
  authorId: string;
  authorNickname: string;
  authorAvatar?: string;
  title: string;
  content: string;
  images: string[];
  likes: number;
  comments: number;
  commentsCount?: number;
  isLiked: boolean;
  isAnonymous: boolean;
  tags: string[];
  color: PostColor;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
}

export interface Comment {
  id: string;
  _id?: string;
  postId: string;
  authorId: string;
  authorNickname: string;
  authorAvatar?: string;
  content: string;
  likes: number;
  isLiked: boolean;
  isAnonymous: boolean;
  parentId?: string;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface PostCreateParams {
  title: string;
  content: string;
  images: string[];
  isAnonymous: boolean;
  tags: string[];
  color: PostColor;
}

export interface CommentCreateParams {
  postId: string;
  content: string;
  parentId?: string;
  isAnonymous: boolean;
}
