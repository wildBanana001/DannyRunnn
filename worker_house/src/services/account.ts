import Taro from '@tarojs/taro';
import { MOCK_PERSONAL_CACHE_KEYS } from '@/data/mock-member';
import { getPaymentApiMode, requestWithMode } from './request';
import { deleteTrackedPostImages } from './upload';

export const ACCOUNT_DELETION_CONFIRMATION = '注销账号';

export interface AccountDeletionBlocker {
  detail: string;
  id: string;
  kind: 'active_card' | 'order';
  title: string;
}

export interface AccountDeletionPreview {
  blockers: AccountDeletionBlocker[];
  canDelete: boolean;
  dataSummary: {
    addresses: number;
    cardOrders: number;
    profiles: number;
    registrations: number;
    userProfile: number;
  };
  retention: {
    description: string;
    orderCount: number;
  };
}

interface CommunityDeletionSummary {
  attempted: boolean;
  commentsDeleted: number;
  failedFileIds: string[];
  filesDeleted: number;
  postsDeleted: number;
  requiresClientCleanup: boolean;
  warning: string;
}

export interface AccountDeletionResult {
  community: CommunityDeletionSummary;
  deleted: {
    activitySignups: number;
    addresses: number;
    cardOrders: number;
    orders: number;
    profiles: number;
    registrations: number;
    userProfiles: number;
  };
  deletedAt: string;
  retained: {
    anonymizedOrders: number;
    description: string;
  };
  success: true;
}

export class AccountDeletionCleanupError extends Error {
  constructor(message = '账号基础数据已删除，但社区内容仍有部分未清理，请保持当前登录状态并重试') {
    super(message);
    this.name = 'AccountDeletionCleanupError';
  }
}

const PERSONAL_STORAGE_KEYS = [
  'user',
  'worker-house-post-file-ids:v1',
  ...MOCK_PERSONAL_CACHE_KEYS,
] as const;

export function fetchAccountDeletionPreview() {
  return requestWithMode<AccountDeletionPreview>(getPaymentApiMode(), {
    path: '/api/account/deletion-preview',
  });
}

export function deleteAccount() {
  return requestWithMode<AccountDeletionResult>(getPaymentApiMode(), {
    data: { confirmation: ACCOUNT_DELETION_CONFIRMATION },
    header: { 'content-type': 'application/json' },
    method: 'DELETE',
    path: '/api/account',
  });
}

export async function finishAccountDataCleanup(result: AccountDeletionResult) {
  const remainingFiles = await deleteTrackedPostImages(result.community.failedFileIds || []);
  if (remainingFiles.length > 0) {
    throw new AccountDeletionCleanupError(`仍有 ${remainingFiles.length} 张社区图片清理失败，请检查网络后重试`);
  }
}

export function clearLocalAccountData() {
  try {
    Taro.clearStorageSync();
    return;
  } catch (error) {
    console.warn('[account deletion] clear all local storage failed, using key fallback', error);
  }

  const failures: string[] = [];
  PERSONAL_STORAGE_KEYS.forEach((key) => {
    try {
      Taro.removeStorageSync(key);
    } catch {
      failures.push(key);
    }
  });
  if (failures.length > 0) {
    throw new AccountDeletionCleanupError('账号已注销，但本机个人数据缓存清理失败，请重启微信后重试');
  }
}
