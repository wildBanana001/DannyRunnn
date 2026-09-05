import { deleteAddressesByOpenid, getAddressesByOpenid } from '../data/addresses.js';
import {
  removePersistedActivityParticipantsByOpenid,
} from '../data/activities.js';
import {
  deleteCardOrdersByOpenid,
  listCardOrdersByOpenid,
} from '../data/cardOrders.js';
import {
  isAccountDeletionBlockingOrder,
  shouldRetainOrderAfterAccountDeletion,
  type OrderRecord,
} from '../data/order-model.js';
import {
  deleteOrAnonymizeOrdersByOpenid,
  getOrdersByOpenid,
  isAccountOrderDeletionBlockedError,
} from '../data/orders.js';
import { deleteProfilesByOpenid, listProfilesByOpenid } from '../data/profiles.js';
import {
  deleteRegistrationsByOpenid,
  listRegistrationsByOpenid,
} from '../data/registrations.js';
import { deleteUserByOpenid, getUserByOpenid } from '../data/users.js';
import { deleteCommunityDataByOpenid } from './community.js';

export const ACCOUNT_DELETION_CONFIRMATION = '注销账号';

export type AccountDeletionBlockerKind = 'active_card' | 'order';

export interface AccountDeletionBlocker {
  detail: string;
  id: string;
  kind: AccountDeletionBlockerKind;
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

export interface CommunityDeletionSummary {
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

export class AccountDeletionBlockedError extends Error {
  readonly code = 'ACCOUNT_DELETION_BLOCKED';
  readonly preview: AccountDeletionPreview;

  constructor(preview: AccountDeletionPreview) {
    super('账号仍有待处理订单或未使用权益，暂时无法注销');
    this.name = 'AccountDeletionBlockedError';
    this.preview = preview;
  }
}

function orderBlocker(order: OrderRecord): AccountDeletionBlocker {
  const detail = order.status === 'pending'
    ? '订单仍在等待支付，请完成支付或等待订单关闭后再试'
    : `订单尚未完成${order.fulfillmentLabel || '履约'}，请先完成服务或联系商家处理`;
  return {
    detail,
    id: order.id,
    kind: 'order',
    title: order.productName || '未完成订单',
  };
}

export async function getAccountDeletionPreview(openid: string): Promise<AccountDeletionPreview> {
  const orders = await getOrdersByOpenid(openid);
  const cardOrders = listCardOrdersByOpenid(openid);
  const blockers: AccountDeletionBlocker[] = [
    ...orders.filter(isAccountDeletionBlockingOrder).map(orderBlocker),
    ...cardOrders
      .filter((item) => item.status === 'active' && item.remainingCount > 0)
      .map((item) => ({
        detail: `仍有 ${item.remainingCount} 次未使用，请先使用完毕或联系商家处理`,
        id: item.id,
        kind: 'active_card' as const,
        title: item.cardType || '未使用次卡',
      })),
  ];

  return {
    blockers,
    canDelete: blockers.length === 0,
    dataSummary: {
      addresses: getAddressesByOpenid(openid).length,
      cardOrders: cardOrders.length,
      profiles: listProfilesByOpenid(openid).length,
      registrations: listRegistrationsByOpenid(openid).length,
      userProfile: getUserByOpenid(openid) ? 1 : 0,
    },
    retention: {
      description: '已支付交易凭证将仅按法律法规及财务对账所需期限保存，并在注销时移除 OpenID、地址、手机号、报名档案等直接身份信息。',
      orderCount: orders.filter(shouldRetainOrderAfterAccountDeletion).length,
    },
  };
}

async function deleteCommunityData(openid: string): Promise<CommunityDeletionSummary> {
  const result = await deleteCommunityDataByOpenid(openid);
  return {
    attempted: true,
    commentsDeleted: result.commentsDeleted,
    failedFileIds: result.failedFileIds,
    filesDeleted: result.filesDeleted,
    postsDeleted: result.postsDeleted,
    requiresClientCleanup: result.failedFileIds.length > 0,
    warning: result.failedFileIds.length > 0 ? '部分社区图片需要由小程序继续清理' : '',
  };
}

export async function deleteAccountData(openid: string): Promise<AccountDeletionResult> {
  const preview = await getAccountDeletionPreview(openid);
  if (!preview.canDelete) throw new AccountDeletionBlockedError(preview);

  let orderDeletion;
  try {
    orderDeletion = await deleteOrAnonymizeOrdersByOpenid(openid);
  } catch (error) {
    if (isAccountOrderDeletionBlockedError(error)) {
      throw new AccountDeletionBlockedError(await getAccountDeletionPreview(openid));
    }
    throw error;
  }

  const activitySignups = await removePersistedActivityParticipantsByOpenid(openid);
  const registrations = deleteRegistrationsByOpenid(openid);
  const cardOrders = deleteCardOrdersByOpenid(openid);
  const profiles = deleteProfilesByOpenid(openid);
  const addresses = deleteAddressesByOpenid(openid);
  const community = await deleteCommunityData(openid);
  const userProfiles = deleteUserByOpenid(openid);

  return {
    success: true,
    deletedAt: new Date().toISOString(),
    deleted: {
      activitySignups,
      addresses,
      cardOrders,
      orders: orderDeletion.deleted,
      profiles,
      registrations,
      userProfiles,
    },
    retained: {
      anonymizedOrders: orderDeletion.anonymized,
      description: preview.retention.description,
    },
    community,
  };
}
