const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const posters = [
  { _id: 'poster-001', id: 'poster-001', title: '旧电视夜谈会', coverImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80', detailImages: ['https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80', 'https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=1200&q=80'], enabled: true, sort: 1, createdAt: '2026-04-20T10:00:00Z' },
  { _id: 'poster-002', id: 'poster-002', title: '拼贴手账周末', coverImage: 'https://images.unsplash.com/photo-1516542076529-1ea3854896f2?w=1200&q=80', detailImages: ['https://images.unsplash.com/photo-1516542076529-1ea3854896f2?w=1200&q=80', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=80'], enabled: true, sort: 2, createdAt: '2026-04-18T10:00:00Z' }
];

const activities = [
  { _id: 'act-001', id: 'act-001', title: '复古拼贴夜谈会', description: '把旧票根、便签和胶带拼成今晚的心情手账。', fullDescription: '在暖黄灯光和旧唱片机陪伴下完成一页属于自己的复古手账。', coverImage: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200&q=80', gallery: ['https://images.unsplash.com/photo-1516542076529-1ea3854896f2?w=1200&q=80'], startDate: '2026-05-03', endDate: '2026-05-03', startTime: '19:30', endTime: '21:30', location: '静安寺', address: '上海市静安区胶州路 118 弄 12 号', price: 168, originalPrice: 199, maxParticipants: 24, currentParticipants: 16, status: 'ongoing', category: '复古手作', tags: ['手账', '拼贴', '社交'], hostId: 'host-001', hostName: '大表哥', hostAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=320&q=80', hostDescription: '偏爱旧物与故事的空间主理人。', venueName: 'worker house 旧物会客厅', venueDescription: '一间带木纹书架、旧电视和暖灯串的小小客厅。', venueImages: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80'], requirements: ['建议穿着舒适服装'], includes: ['手账基础材料包'], refundPolicy: '活动开始前 24 小时可全额退款。', createdAt: '2026-04-20T10:00:00Z', updatedAt: '2026-04-24T18:00:00Z' },
  { _id: 'act-002', id: 'act-002', title: '旧胶片摄影散步', description: '一起走过梧桐路，把黄昏和笑声都收进胶片里。', fullDescription: '从武康路出发，带着一次性胶片相机边走边拍。', coverImage: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200&q=80', gallery: ['https://images.unsplash.com/photo-1493863641943-9b68992a8d07?w=1200&q=80'], startDate: '2026-05-10', endDate: '2026-05-10', startTime: '15:00', endTime: '18:00', location: '武康路', address: '上海市徐汇区武康路 390 号', price: 99, maxParticipants: 18, currentParticipants: 11, status: 'ongoing', category: '城市散步', tags: ['摄影', '散步', '城市'], hostId: 'host-001', hostName: '大表哥', hostAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=320&q=80', hostDescription: '总在城市里寻找慢镜头。', venueName: '梧桐街角', venueDescription: '适合散步、聊天和拍照的老街路线。', venueImages: ['https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1200&q=80'], requirements: ['请穿舒适鞋子'], includes: ['一次性胶片一卷'], refundPolicy: '活动开始前 12 小时可改期一次。', createdAt: '2026-04-18T10:00:00Z', updatedAt: '2026-04-25T08:00:00Z' },
  { _id: 'act-101', id: 'act-101', title: '春日咖啡拼盘手作', description: '用旧茶碟、花瓣与咖啡香做一张春日拼盘。', fullDescription: '已经结束的咖啡主题手作活动。', coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&q=80', gallery: ['https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=1200&q=80'], startDate: '2026-04-12', endDate: '2026-04-12', startTime: '14:00', endTime: '17:00', location: '愚园路', address: '上海市长宁区愚园路 1088 号', price: 128, maxParticipants: 16, currentParticipants: 16, status: 'ended', category: '咖啡手作', tags: ['咖啡', '拼贴'], hostId: 'host-003', hostName: 'Mia', hostAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=320&q=80', hostDescription: '擅长把日常做成好看的纪念品。', venueName: 'worker house 咖啡角', venueDescription: '带着烘豆香气的小角落。', venueImages: ['https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=1200&q=80'], requirements: [], includes: [], refundPolicy: '', createdAt: '2026-03-15T10:00:00Z', updatedAt: '2026-04-12T18:00:00Z' }
];

const posts = [
  { _id: 'post-001', id: 'post-001', authorId: 'user-001', authorNickname: '匿名打工人', content: '今天在下班路上买了一卷旧车票，把它贴在手账本里的一瞬间，突然觉得这周也没有那么糟。', images: [], likes: 42, comments: 3, commentsCount: 3, isLiked: false, isAnonymous: true, tags: ['下班回血', '手账碎片'], color: 'yellow', createdAt: '2026-04-25T08:30:00Z', updatedAt: '2026-04-25T08:30:00Z' },
  { _id: 'post-002', id: 'post-002', authorId: 'user-002', authorNickname: '香蕉', authorAvatar: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=320&q=80', content: '周末想办一个“旧书换旧梦”的小活动，大家会想带什么来交换？', images: ['https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200&q=80'], likes: 88, comments: 2, commentsCount: 2, isLiked: true, isAnonymous: false, tags: ['活动脑暴', '旧书交换'], color: 'pink', createdAt: '2026-04-24T20:15:00Z', updatedAt: '2026-04-24T20:15:00Z' },
  { _id: 'post-003', id: 'post-003', authorId: 'user-003', authorNickname: '留声机小姐', authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=320&q=80', content: '最近最喜欢 worker house 里那台旧电视角，坐在那里发呆五分钟，像偷偷从工作里逃走了一会儿。', images: [], likes: 56, comments: 1, commentsCount: 1, isLiked: false, isAnonymous: false, tags: ['空间日记'], color: 'blue', createdAt: '2026-04-24T14:20:00Z', updatedAt: '2026-04-24T14:20:00Z' }
];

const comments = [
  { _id: 'comment-001', id: 'comment-001', postId: 'post-001', authorId: 'user-101', authorNickname: '抱抱你', content: '会，我最近也靠把旧票根贴起来找回一点掌控感。', likes: 5, isLiked: false, isAnonymous: false, createdAt: '2026-04-25T09:00:00Z', updatedAt: '2026-04-25T09:00:00Z' },
  { _id: 'comment-002', id: 'comment-002', postId: 'post-001', authorId: 'user-102', authorNickname: '匿名用户', content: '小东西真的很有治愈力。', likes: 3, isLiked: false, isAnonymous: true, createdAt: '2026-04-25T09:30:00Z', updatedAt: '2026-04-25T09:30:00Z' },
  { _id: 'comment-003', id: 'comment-003', postId: 'post-002', authorId: 'user-104', authorNickname: '会带诗集的人', content: '我想带一本到处都是铅笔记号的诗集。', likes: 2, isLiked: false, isAnonymous: false, createdAt: '2026-04-24T21:00:00Z', updatedAt: '2026-04-24T21:00:00Z' }
];

const siteConfig = [{ _id: 'site-001', videoCover: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200&q=80', videoLink: 'https://channels.weixin.qq.com', finderUserName: 'export/UzFfAgtgekIEAQAAAAAA7rs5OQ_zcQAAAAstQy6ubaLX4KHWvLEZgBPE1qMsECFcBvGKzNPgMJpL10i6zxmLfZDm8KdEhzGE', spaceImage: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80', spaceDescription: 'worker house 想做一个像旧客厅一样的地方。', ownerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=320&q=80', ownerName: '大表哥', ownerBio: '一个喜欢旧物、手账和夜谈的空间主理人。', createdAt: '2026-04-20T10:00:00Z' }];

const collections = [
  ['posters', posters],
  ['activities', activities],
  ['posts', posts],
  ['comments', comments],
  ['site_config', siteConfig]
];

async function resetCollection(name, data) {
  await db.collection(name).where({}).remove();
  for (const item of data) {
    await db.collection(name).add({ data: item });
  }
}

exports.main = async () => {
  try {
    for (const [name, data] of collections) {
      await resetCollection(name, data);
    }
    return { success: true, data: { collections: collections.map(([name]) => name) } };
  } catch (error) {
    return { success: false, error: error.message || 'seed 失败' };
  }
};
