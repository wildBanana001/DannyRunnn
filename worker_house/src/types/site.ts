export type HomeDynamicType = 'video' | 'story' | 'activity' | 'external';

export interface Poster {
  id: string;
  title: string;
  coverImage: string;
  detailImages: string[];
  enabled: boolean;
  sort: number;
  createdAt: string;
  type?: 'default' | 'particle-slogan';
  fixed?: boolean;
}

export interface HomeVideo {
  id: string;
  cover: string;
  title: string;
  finderUserName: string;
  feedId?: string;
  videoLink?: string;
  type?: HomeDynamicType;
  relatedId?: string;
  summary?: string;
  videoUrl?: string;
}

export interface SiteConfig {
  videoCover: string;
  videoLink: string;
  finderUserName: string;
  videos?: HomeVideo[];
  spaceImage: string;
  spaceDescription: string;
  ownerAvatar: string;
  ownerName: string;
  ownerBio: string;
  title?: string;
}

export interface CloudResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
