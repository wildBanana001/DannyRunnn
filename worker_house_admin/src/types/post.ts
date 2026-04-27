export interface Post {
  id: string;
  authorId: string;
  authorNickname: string;
  authorAvatar?: string;
  content: string;
  images: string[];
  likes: number;
  comments: number;
  isLiked: boolean;
  isAnonymous: boolean;
  tags: string[];
  color?: 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'purple';
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
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
  content: string;
  images: string[];
  isAnonymous: boolean;
  tags: string[];
}

export interface CommentCreateParams {
  postId: string;
  content: string;
  parentId?: string;
  isAnonymous: boolean;
}
