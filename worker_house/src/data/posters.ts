import type { Poster } from '@/types/site';
import { wechatArticleImageUrls } from './wechat-images';

export const posters: Poster[] = [
  {
    id: 'poster-001',
    title: 'House Party 客厅行动计划',
    coverImage: wechatArticleImageUrls.img01,
    detailImages: [wechatArticleImageUrls.img01],
    enabled: true,
    sort: 1,
    createdAt: '2026-04-26T09:00:00Z'
  },
  {
    id: 'poster-002',
    title: '4 月故事录：我们在客厅看见彼此',
    coverImage: wechatArticleImageUrls.img04,
    detailImages: [wechatArticleImageUrls.img04],
    enabled: true,
    sort: 2,
    createdAt: '2026-04-26T08:50:00Z'
  },
  {
    id: 'poster-003',
    title: '5 月活动总览 · deeptalk & houseparty',
    coverImage: wechatArticleImageUrls.img05,
    detailImages: [wechatArticleImageUrls.img05],
    enabled: true,
    sort: 3,
    createdAt: '2026-04-26T08:40:00Z'
  },
  {
    id: 'poster-004',
    title: '4 月排期回看',
    coverImage: wechatArticleImageUrls.img31,
    detailImages: [wechatArticleImageUrls.img31],
    enabled: true,
    sort: 4,
    createdAt: '2026-04-26T08:30:00Z'
  },
  {
    id: 'poster-005',
    title: '3 月排期回看',
    coverImage: wechatArticleImageUrls.img32,
    detailImages: [wechatArticleImageUrls.img32],
    enabled: true,
    sort: 5,
    createdAt: '2026-04-26T08:20:00Z'
  }
];
