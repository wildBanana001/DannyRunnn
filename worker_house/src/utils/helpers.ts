import type { Activity } from '@/types/activity';
import type { Post } from '@/types/post';

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${month}月${day}日 ${weekDays[date.getDay()]}`;
};

export const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

export const formatMonthTitle = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
};

export const formatPrice = (price: number): string => `¥${price}`;

export const formatNumber = (num: number): string => {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  return String(num);
};

export const buildPostTitle = (title: string | undefined, content: string): string => {
  const safeTitle = (title || '').trim();
  if (safeTitle) {
    return safeTitle;
  }
  return content.trim().slice(0, 18) || '未命名留言';
};

export const getPostExcerpt = (content: string, maxLength = 42): string => {
  const safeContent = content.trim();
  if (safeContent.length <= maxLength) {
    return safeContent;
  }
  return `${safeContent.slice(0, maxLength)}...`;
};

export const getRelativeTime = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return formatDate(dateStr);
};

export const getActivityStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    upcoming: '即将开始',
    ongoing: '进行中',
    ended: '已结束'
  };
  return statusMap[status] || status;
};

export const getRegistrationStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: '待添加主理人微信：DannyRunnn 缴费报名',
    paid: '待线下确认',
    confirmed: '已报名成功',
    cancelled: '已取消'
  };
  return statusMap[status] || status;
};

export const getRegistrationStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    pending: '#F4C430',
    paid: '#5E8B73',
    confirmed: '#E60000',
    cancelled: '#8B7355'
  };
  return colorMap[status] || '#8B7355';
};

export const getProgressPercent = (current: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((current / total) * 100));
};

export const getPostCommentCount = (post: Pick<Post, 'comments' | 'commentsCount'>): number => post.commentsCount ?? post.comments;

export const matchPostKeyword = (post: Pick<Post, 'title' | 'content' | 'tags'>, keyword: string): boolean => {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }

  const matchSource = [post.title, post.content, ...post.tags].join(' ').toLowerCase();
  return matchSource.includes(normalizedKeyword);
};

export const groupActivitiesByMonth = (activities: Activity[]): Array<{ month: string; items: Activity[] }> => {
  const groups = activities.reduce<Record<string, Activity[]>>((accumulator, activity) => {
    const month = formatMonthTitle(activity.startDate);
    if (!accumulator[month]) {
      accumulator[month] = [];
    }
    accumulator[month].push(activity);
    return accumulator;
  }, {});

  return Object.entries(groups).map(([month, items]) => ({
    month,
    items: items.sort((prev, next) => new Date(next.startDate).getTime() - new Date(prev.startDate).getTime())
  }));
};

export const estimatePostHeight = (post: Post): number => {
  const titleLines = post.title ? Math.min(2, Math.max(1, Math.ceil(post.title.length / 12))) : 0;
  const textLines = Math.min(6, Math.max(2, Math.ceil(post.content.length / 18)));
  const imageHeight = post.images.length > 0 ? 180 : 0;
  const tagHeight = post.tags.length > 0 ? 60 : 0;
  return 186 + titleLines * 34 + textLines * 32 + imageHeight + tagHeight;
};

export const getFixedTilt = (index: number): number => (index % 3 - 1) * 3;
