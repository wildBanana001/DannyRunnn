import dayjs from 'dayjs';
import type {
  Activity,
  CardOrderStatus,
  CardUsageStatus,
  ProfileGender,
  RegistrationStatus,
} from '@/types';

export const ACTIVITY_STATUS_LABEL_MAP: Record<Activity['status'], string> = {
  upcoming: '未开始',
  ongoing: '进行中',
  ended: '已结束',
};

export const ACTIVITY_STATUS_COLOR_MAP: Record<Activity['status'], string> = {
  upcoming: 'processing',
  ongoing: 'success',
  ended: 'default',
};

export const PROFILE_GENDER_LABEL_MAP: Record<ProfileGender, string> = {
  female: '女',
  male: '男',
  other: '其他',
};

export const REGISTRATION_STATUS_LABEL_MAP: Record<RegistrationStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  cancelled: '已取消',
  completed: '已完成',
};

export const REGISTRATION_STATUS_COLOR_MAP: Record<RegistrationStatus, string> = {
  pending: 'warning',
  confirmed: 'processing',
  cancelled: 'default',
  completed: 'success',
};

export const CARD_ORDER_STATUS_LABEL_MAP: Record<CardOrderStatus, string> = {
  active: '生效中',
  expired: '已过期',
  refunded: '已退款',
};

export const CARD_ORDER_STATUS_COLOR_MAP: Record<CardOrderStatus, string> = {
  active: 'processing',
  expired: 'default',
  refunded: 'error',
};

export const CARD_USAGE_STATUS_LABEL_MAP: Record<CardUsageStatus, string> = {
  used: '已抵扣',
  reverted: '已回退',
};

export const CARD_USAGE_STATUS_COLOR_MAP: Record<CardUsageStatus, string> = {
  used: 'success',
  reverted: 'warning',
};

export function formatDate(value?: string, format = 'YYYY-MM-DD') {
  if (!value) {
    return '--';
  }

  return dayjs(value).format(format);
}

export function formatDateTime(value?: string) {
  return formatDate(value, 'YYYY-MM-DD HH:mm');
}

export function formatCurrency(value?: number) {
  if (typeof value !== 'number') {
    return '--';
  }

  return `¥${value.toLocaleString('zh-CN')}`;
}

export function getTextExcerpt(content: string, maxLength = 80) {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength)}...`;
}

export function getActivityPrimaryCover(
  activity: Pick<Activity, 'cover' | 'coverImage' | 'covers'>,
) {
  return activity.covers[0] || activity.cover || activity.coverImage || '';
}
