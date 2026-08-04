import Taro from '@tarojs/taro';
import { getPaymentApiMode, requestWithMode } from './request';
import { deleteTrackedPostImages } from './upload';

declare const wx: any;

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

interface DirectCommunityDeletionResult {
  commentsDeleted: number;
  failedFileIds: string[];
  filesDeleted: number;
  postsDeleted: number;
}

export class AccountDeletionCleanupError extends Error {
  constructor(message = '账号基础数据已删除，但社区内容仍有部分未清理，请保持当前登录状态并重试') {
    super(message);
    this.name = 'AccountDeletionCleanupError';
  }
}

const PERSONAL_STORAGE_KEYS = [
  'user',
  'worker-house-mock-wx-user',
  'worker-house-mock-addresses-v1',
  'worker-house-mock-shop-orders-v2',
  'worker-house-member-state-v5',
  'worker-house-post-file-ids:v1',
] as const;

function getCloudApi() {
  return (Taro as any).cloud || (typeof wx !== 'undefined' ? (wx as any).cloud : null);
}

function parseCloudFunctionResult(value: unknown) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

async function deleteCommunityDataAsCurrentUser(): Promise<DirectCommunityDeletionResult> {
  const cloudApi = getCloudApi();
  if (!cloudApi?.callFunction) {
    throw new AccountDeletionCleanupError('当前微信环境无法完成社区内容清理，请稍后在小程序内重试');
  }

  const response = await cloudApi.callFunction({
    name: 'post',
    data: { action: 'deleteAccountData' },
  });
  const payload = parseCloudFunctionResult(response?.result) as {
    data?: Partial<DirectCommunityDeletionResult>;
    error?: string;
    success?: boolean;
  } | null;
  if (!payload || payload.success !== true) {
    throw new AccountDeletionCleanupError(payload?.error || '社区内容清理未完成，请稍后重试');
  }

  return {
    commentsDeleted: Math.max(0, Number(payload.data?.commentsDeleted) || 0),
    failedFileIds: Array.isArray(payload.data?.failedFileIds)
      ? payload.data.failedFileIds.map((item) => String(item)).filter(Boolean)
      : [],
    filesDeleted: Math.max(0, Number(payload.data?.filesDeleted) || 0),
    postsDeleted: Math.max(0, Number(payload.data?.postsDeleted) || 0),
  };
}

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
  let failedFileIds = [...(result.community.failedFileIds || [])];
  let directCleanupError: unknown = null;

  if (result.community.requiresClientCleanup) {
    try {
      const directResult = await deleteCommunityDataAsCurrentUser();
      failedFileIds = [...failedFileIds, ...directResult.failedFileIds];
    } catch (error) {
      directCleanupError = error;
    }
  }

  const remainingFiles = await deleteTrackedPostImages(failedFileIds);
  if (directCleanupError) throw directCleanupError;
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
