import Taro from '@tarojs/taro';
import { fetchActivity } from '@/cloud/services';
import {
  buyMockCard,
  deleteMockProfile,
  getMockCardUsageLogs,
  getMockCurrentCard,
  getMockProfiles,
  getMockRegistrationDetail,
  getMockRegistrations,
  setMockDefaultProfile,
  upsertMockProfile,
} from '@/data/mock-member';
import type { Activity, CardOrder, CardPackage, CardUsageLog, Profile, ProfileFormValue, Registration } from '@/types';
import { getApiMode, getPaymentApiMode, request, requestWithMode, type RequestOptions } from './request';

interface ListResponse<T> {
  data?: T[];
  list: T[];
  total?: number;
}

interface SaveProfilePayload extends ProfileFormValue {
  id?: string;
}

export interface SubmitRegistrationPayload {
  activityId: string;
  profile: Profile;
  useCard: boolean;
  clientRequestId: string;
}

export type ActivityPaymentOrderStatus = 'pending' | 'paid' | 'failed' | 'closed';

export interface ActivityPaymentSession {
  registration: Registration;
  outTradeNo: string;
  amount: number;
  status: ActivityPaymentOrderStatus;
  mock: boolean;
  payment?: {
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: 'RSA';
    paySign: string;
  };
}

export interface MemberOverview {
  registrationsCount: number;
  remainingCardTimes: number;
  defaultProfileName?: string;
  likesReceived: number;
}

const isMockMode = () => getApiMode() === 'mock';
const isRegistrationMockMode = () => getPaymentApiMode() === 'mock';
const REAL_PAYMENT_ONLY_MESSAGE = '当前仅支持在微信小程序中使用微信支付';
const MOCK_PAYMENT_REJECTED_MESSAGE = '支付服务仍处于模拟模式，请先部署真实微信支付配置';

const registrationRequest = <T>(options: RequestOptions) => (
  requestWithMode<T>(getPaymentApiMode(), options)
);

function assertRealPaymentRuntime() {
  if (isRegistrationMockMode()) {
    throw new Error(REAL_PAYMENT_ONLY_MESSAGE);
  }
}

function assertRealPaymentSession(session: ActivityPaymentSession): ActivityPaymentSession {
  if (session.mock) {
    throw new Error(MOCK_PAYMENT_REJECTED_MESSAGE);
  }
  return session;
}

const withMode = async <T>(fallback: () => T | Promise<T>, remote?: () => Promise<T>): Promise<T> => {
  if (isMockMode() || !remote) {
    return fallback();
  }
  return remote();
};

const sortCardOrders = (orders: CardOrder[]) => {
  return [...orders].sort((prev, next) => new Date(next.purchasedAt).getTime() - new Date(prev.purchasedAt).getTime());
};

const resolveCurrentCardOrder = (orders: CardOrder[]): CardOrder | null => {
  const sortedOrders = sortCardOrders(orders);
  return sortedOrders.find((item) => item.status === 'active' && item.remainingCount > 0) || sortedOrders[0] || null;
};

const attachActivities = async (registrations: Registration[]): Promise<Registration[]> => {
  const activityMap = new Map<string, Activity>();
  const activityIds = Array.from(new Set(
    registrations.filter((item) => !item.activity && !item.activitySnapshot).map((item) => item.activityId)
  ));

  await Promise.all(
    activityIds.map(async (activityId) => {
      try {
        const activity = await fetchActivity(activityId, { fallbackToMock: false });
        if (activity) {
          activityMap.set(activityId, activity);
        }
      } catch (error) {
        console.warn('[member] attach activity failed', activityId, error);
      }
    })
  );

  return registrations.map((item) => ({
    ...item,
    activity: item.activity ?? activityMap.get(item.activityId) ?? item.activitySnapshot ?? null,
  }));
};

export async function fetchProfiles(): Promise<Profile[]> {
  return withMode(
    () => getMockProfiles(),
    async () => {
      const response = await request<ListResponse<Profile>>({ path: '/api/profiles' });
      return response.list;
    }
  );
}

export async function saveProfile(payload: SaveProfilePayload): Promise<Profile> {
  return withMode(
    () => upsertMockProfile(payload),
    async () => {
      if (payload.id) {
        return request<Profile>({
          data: payload,
          method: 'PUT',
          path: `/api/profiles/${encodeURIComponent(payload.id)}`,
        });
      }
      return request<Profile>({
        data: payload,
        method: 'POST',
        path: '/api/profiles',
      });
    }
  );
}

export async function removeProfile(id: string): Promise<Profile[]> {
  return withMode(
    () => deleteMockProfile(id),
    async () => {
      await request<{ success: boolean }>({
        method: 'DELETE',
        path: `/api/profiles/${encodeURIComponent(id)}`,
      });
      return fetchProfiles();
    }
  );
}

export async function setDefaultProfile(id: string): Promise<Profile[]> {
  return withMode(
    () => setMockDefaultProfile(id),
    async () => {
      await request<Profile>({
        method: 'PUT',
        path: `/api/profiles/${encodeURIComponent(id)}/default`,
      });
      return fetchProfiles();
    }
  );
}

export async function fetchRegistrations(): Promise<Registration[]> {
  if (isRegistrationMockMode()) {
    return getMockRegistrations();
  }
  const response = await registrationRequest<ListResponse<Registration>>({
    path: '/api/shop/activity-registrations/mine',
  });
  return attachActivities(response.list);
}

export async function fetchRegistrationDetail(id: string): Promise<Registration | null> {
  if (isRegistrationMockMode()) {
    return getMockRegistrationDetail(id);
  }
  const registration = await registrationRequest<Registration | null>({
    path: `/api/shop/activity-registrations/${encodeURIComponent(id)}`,
  });
  if (!registration) return null;
  const [detail] = await attachActivities([registration]);
  return detail;
}

export async function submitRegistrationOrder(payload: SubmitRegistrationPayload): Promise<ActivityPaymentSession> {
  assertRealPaymentRuntime();

  const session = await registrationRequest<ActivityPaymentSession>({
    data: {
      activityId: payload.activityId,
      clientRequestId: payload.clientRequestId,
      useCard: false,
      profile: {
        profileId: payload.profile.id,
        participantNickname: payload.profile.nickname,
        wechatName: payload.profile.wechatName,
        phone: payload.profile.phone,
        profileSnapshot: {
          nickname: payload.profile.nickname,
          gender: payload.profile.gender,
          ageRange: payload.profile.ageRange,
          industry: payload.profile.industry,
          occupation: payload.profile.occupation,
          city: payload.profile.city,
          socialGoal: payload.profile.socialGoal,
          introduction: payload.profile.introduction,
        },
      },
    },
    method: 'POST',
    path: '/api/shop/activity-registrations/pay',
  });
  return assertRealPaymentSession(session);
}

export function createActivityPaymentClientRequestId() {
  return `activity-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isDirectActivityPaymentEnabled() {
  return true;
}

export function isActivityPaymentCancelled(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : String((error as { errMsg?: unknown })?.errMsg || error || '');
  return message.toLowerCase().includes('cancel');
}

export async function launchActivityPayment(session: ActivityPaymentSession) {
  assertRealPaymentSession(session);
  if (session.status === 'paid') return;
  if (!session.payment) throw new Error('支付参数缺失，请重新报名');
  await Taro.requestPayment(session.payment);
}

export async function retryActivityPayment(registrationId: string): Promise<ActivityPaymentSession> {
  assertRealPaymentRuntime();
  const session = await registrationRequest<ActivityPaymentSession>({
    method: 'POST',
    path: `/api/shop/activity-registrations/${encodeURIComponent(registrationId)}/retry`,
  });
  return assertRealPaymentSession(session);
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function confirmActivityPayment(registrationId: string): Promise<Registration> {
  const retryDelays = [0, 800, 1600];
  let registration: Registration | null = null;
  for (const delay of retryDelays) {
    if (delay > 0) await wait(delay);
    registration = await fetchRegistrationDetail(registrationId);
    if (registration && registration.status !== 'pending' && registration.status !== 'paid') {
      return registration;
    }
  }
  if (!registration) throw new Error('支付结果查询失败');
  return registration;
}

export async function fetchCurrentCardOrder(): Promise<CardOrder | null> {
  return withMode(
    () => getMockCurrentCard(),
    async () => {
      const response = await request<ListResponse<CardOrder>>({ path: '/api/card-orders' });
      return resolveCurrentCardOrder(response.list);
    }
  );
}

export async function fetchCardUsageLogs(): Promise<CardUsageLog[]> {
  return withMode(
    () => getMockCardUsageLogs(),
    async () => {
      const currentCard = await fetchCurrentCardOrder();
      if (!currentCard) {
        return [];
      }
      const response = await request<ListResponse<CardUsageLog>>({
        path: `/api/card-orders/${encodeURIComponent(currentCard.id)}/usage-logs`,
      });
      return response.list;
    }
  );
}

export async function fetchCardPackages(): Promise<CardPackage[]> {
  return withMode(
    () => [
      {
        id: 'mock-card-package-3x',
        name: '社畜次卡 3 次装',
        totalCount: 3,
        price: 399,
        perUseMaxOffset: 148,
        validDays: 180,
        status: 'active',
        sortOrder: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    async () => {
      const response = await request<ListResponse<CardPackage>>({ path: '/api/card-packages' });
      return response.data ?? response.list ?? [];
    }
  );
}

export async function purchaseCardOrder(packageId?: string): Promise<CardOrder> {
  return withMode(
    () => buyMockCard(),
    async () => request<CardOrder>({
      data: packageId ? { packageId } : undefined,
      method: 'POST',
      path: '/api/card-orders',
    })
  );
}

export async function fetchMemberOverview(): Promise<MemberOverview> {
  const [registrations, currentCard, profiles] = await Promise.all([
    fetchRegistrations(),
    fetchCurrentCardOrder(),
    fetchProfiles(),
  ]);

  return {
    registrationsCount: registrations.length,
    remainingCardTimes: currentCard?.remainingCount || 0,
    defaultProfileName: profiles.find((item) => item.isDefault)?.nickname,
    likesReceived: 0,
  };
}
