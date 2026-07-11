import type { Story } from '@/types';

/**
 * 首页"社畜故事"兜底数据。
 * 当 BFF /api/stories 接口返回空列表或请求失败时使用，
 * 至少保证首页有一条可跳转公众号文章的故事。
 */
export const homeStoriesFallback: Story[] = [
  {
    id: 'story-fallback-olio',
    title: '做客「闲人会客厅」：我有创造快乐的能力！',
    cover: 'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/wechat-articles/batch-2026-04-26/01-U_Z3cyia/img-01.jpg',
    excerpt: '基于奥利奥用心思考和提问的框架下，记录了橙籽一年多以来 0 - 1 创业的探索、成长、思考，她相信自己拥有让自己、让别人快乐的能力。',
    publishAt: '2025年11月5日 21:28',
    author: '月球上的奥利奥',
    sourceUrl: 'https://mp.weixin.qq.com/s/U_Z3cyiakjrgweybmw-dqw',
    content: '',
  },
];
