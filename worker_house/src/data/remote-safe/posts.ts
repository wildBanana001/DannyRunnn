import type { Comment, Post } from '@/types/post';

// Community fixtures are available only in explicit mock builds. Production
// bundles receive all posts and comments from the BFF.
export const posts: Post[] = [];
export const comments: Comment[] = [];
