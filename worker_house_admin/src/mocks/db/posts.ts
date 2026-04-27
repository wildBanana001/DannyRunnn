import dayjs from 'dayjs';
import type { Post } from '@/types/post';

export const postSeedData: Post[] = [
  {
    id: 'post-001',
    authorId: 'user-001',
    authorNickname: '匿名打工人',
    content:
      '今天又被老板骂了，明明不是我的错，却要背锅。职场真的好难，什么时候才能遇到靠谱的领导和团队啊...',
    images: [],
    likes: 42,
    comments: 18,
    isLiked: false,
    isAnonymous: true,
    tags: ['职场吐槽', '心情'],
    color: 'yellow',
    isPinned: false,
    createdAt: '2026-04-25T08:30:00Z',
    updatedAt: '2026-04-25T08:30:00Z',
  },
  {
    id: 'post-002',
    authorId: 'user-002',
    authorNickname: '咖啡爱好者',
    authorAvatar: 'https://picsum.photos/id/64/200/200',
    content:
      '周末参加了手冲咖啡体验课，真的太棒了！老师很专业，学到了很多知识。最重要的是认识了一群志同道合的朋友，已经约好下次一起去探店了~',
    images: ['https://picsum.photos/id/292/750/500', 'https://picsum.photos/id/312/750/500'],
    likes: 89,
    comments: 23,
    isLiked: true,
    isAnonymous: false,
    tags: ['活动分享', '咖啡', '交友'],
    color: 'pink',
    isPinned: false,
    createdAt: '2026-04-24T20:15:00Z',
    updatedAt: '2026-04-24T20:15:00Z',
  },
  {
    id: 'post-003',
    authorId: 'user-003',
    authorNickname: '匿名用户',
    content:
      '30岁还单身，家里催婚催得紧，但我不想为了结婚而结婚。一个人也挺好的，有自己的事业，有自己的爱好，周末参加活动认识新朋友，生活很充实。',
    images: [],
    likes: 156,
    comments: 67,
    isLiked: false,
    isAnonymous: true,
    tags: ['情感', '生活感悟'],
    color: 'blue',
    isPinned: false,
    createdAt: '2026-04-24T14:20:00Z',
    updatedAt: '2026-04-24T14:20:00Z',
  },
  {
    id: 'post-004',
    authorId: 'user-004',
    authorNickname: '摄影师小李',
    authorAvatar: 'https://picsum.photos/id/177/200/200',
    content:
      '上周的城市摄影漫步活动拍到了很多满意的照片！分享几张给大家看看，外滩的日落真的太美了。',
    images: [
      'https://picsum.photos/id/1015/750/500',
      'https://picsum.photos/id/1018/750/500',
      'https://picsum.photos/id/1019/750/500',
    ],
    likes: 234,
    comments: 45,
    isLiked: true,
    isAnonymous: false,
    tags: ['摄影', '活动分享', '上海'],
    color: 'green',
    isPinned: false,
    createdAt: '2026-04-23T18:00:00Z',
    updatedAt: '2026-04-23T18:00:00Z',
  },
  {
    id: 'post-005',
    authorId: 'user-005',
    authorNickname: '匿名社畜',
    content:
      '每天通勤2小时，工资一半交房租，剩下的勉强够生活。这就是大城市的生存现状吗？有时候真的很想回老家，但又舍不得这里的资源和机会...',
    images: [],
    likes: 312,
    comments: 89,
    isLiked: false,
    isAnonymous: true,
    tags: ['生活吐槽', '打工人'],
    color: 'orange',
    isPinned: false,
    createdAt: '2026-04-23T12:30:00Z',
    updatedAt: '2026-04-23T12:30:00Z',
  },
  {
    id: 'post-006',
    authorId: 'user-006',
    authorNickname: '甜点控',
    authorAvatar: 'https://picsum.photos/id/338/200/200',
    content:
      '法式甜点课的作品！第一次做马卡龙就成功了，虽然过程有点坎坷，但看到成品的那一刻真的太有成就感了！',
    images: ['https://picsum.photos/id/431/750/500', 'https://picsum.photos/id/835/750/500'],
    likes: 178,
    comments: 32,
    isLiked: true,
    isAnonymous: false,
    tags: ['烘焙', '活动分享', '美食'],
    color: 'purple',
    isPinned: false,
    createdAt: '2026-04-22T16:45:00Z',
    updatedAt: '2026-04-22T16:45:00Z',
  },
  {
    id: 'post-007',
    authorId: 'user-007',
    authorNickname: '匿名用户',
    content:
      '工作三年，终于升职了！虽然压力更大了，但感觉自己的努力得到了认可。想对在奋斗路上的朋友们说：坚持下去，总会有回报的！',
    images: [],
    likes: 267,
    comments: 56,
    isLiked: false,
    isAnonymous: true,
    tags: ['职场', '正能量'],
    color: 'yellow',
    isPinned: false,
    createdAt: '2026-04-22T09:00:00Z',
    updatedAt: '2026-04-22T09:00:00Z',
  },
  {
    id: 'post-008',
    authorId: 'user-008',
    authorNickname: '花艺师小陈',
    authorAvatar: 'https://picsum.photos/id/1027/200/200',
    content:
      '插花课的作品分享~ 这次学的是日式花道，讲究的是自然和谐之美。花材虽然简单，但意境很重要。',
    images: ['https://picsum.photos/id/1080/750/500'],
    likes: 145,
    comments: 28,
    isLiked: false,
    isAnonymous: false,
    tags: ['花艺', '活动分享'],
    color: 'pink',
    isPinned: false,
    createdAt: '2026-04-21T15:30:00Z',
    updatedAt: '2026-04-21T15:30:00Z',
  },
  {
    id: 'post-009',
    authorId: 'user-014',
    authorNickname: '珠海打工观察员',
    authorAvatar: 'https://picsum.photos/id/1005/200/200',
    content:
      '最近在珠海高新区参加了一个 AI 从业者线下局，发现大家都在聊效率、情绪稳定和生活平衡。原来不是只有我一个人在努力找节奏。',
    images: ['https://picsum.photos/id/1062/750/500'],
    likes: 96,
    comments: 14,
    isLiked: false,
    isAnonymous: false,
    tags: ['珠海', 'AI', '打工人'],
    color: 'blue',
    isPinned: false,
    createdAt: '2026-04-21T09:40:00Z',
    updatedAt: '2026-04-21T09:40:00Z',
  },
  {
    id: 'post-010',
    authorId: 'user-015',
    authorNickname: '匿名程序员',
    content:
      '项目节奏很赶的时候，最怕的是沟通成本不断上升。有没有人分享一下你们团队是怎么做需求评审和节奏管理的？',
    images: [],
    likes: 121,
    comments: 37,
    isLiked: false,
    isAnonymous: true,
    tags: ['程序员', '沟通', '团队协作'],
    color: 'green',
    isPinned: false,
    createdAt: '2026-04-20T21:10:00Z',
    updatedAt: '2026-04-20T21:10:00Z',
  },
];

let posts = [...postSeedData];

export function resetPosts() {
  posts = [...postSeedData];
}

export function listPosts() {
  return [...posts];
}

export function updatePostPinState(id: string, isPinned: boolean) {
  const currentPost = posts.find((post) => post.id === id);

  if (!currentPost) {
    return null;
  }

  const nextPost: Post = {
    ...currentPost,
    isPinned,
    updatedAt: dayjs().toISOString(),
  };

  posts = posts.map((post) => (post.id === id ? nextPost : post));
  return nextPost;
}

export function deletePostRecord(id: string) {
  const exists = posts.some((post) => post.id === id);
  posts = posts.filter((post) => post.id !== id);
  return exists;
}
