import { fetchActivity } from '@/cloud/services';
import {
  buyMockCard,
  createMockRegistration,
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
import { getApiMode, request } from './request';

interface ListResponse<T> {
  data?: T[];
  list: T[];
  total?: number;
}

interface SaveProfilePayload extends ProfileFormValue {
  id?: string;
}

interface SubmitRegistrationPayload {
  activityId: string;
  profileId: string;
  useCard: boolean;
}

export interface MemberOverview {
  registrationsCount: number;
  postsCount: number;
  remainingCardTimes: number;
  defaultProfileName?: string;
  likesReceived: number;
}

const isMockMode = () => getApiMode() === 'mock';

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
  const activityIds = Array.from(new Set(registrations.filter((item) => !item.activity).map((item) => item.activityId)));

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
  return withMode(
    () => getMockRegistrations(),
    async () => {
      const response = await request<ListResponse<Registration>>({ path: '/api/registrations' });
      return attachActivities(response.list);
    }
  );
}

export async function fetchRegistrationDetail(id: string): Promise<Registration | null> {
  return withMode(
    () => getMockRegistrationDetail(id),
    async () => {
      const registration = await request<Registration | null>({ path: `/api/registrations/${encodeURIComponent(id)}` });
      if (!registration) {
        return null;
      }
      const [detail] = await attachActivities([registration]);
      return detail;
    }
  );
}

export async function submitRegistrationOrder(payload: SubmitRegistrationPayload): Promise<Registration> {
  return withMode(
    () => createMockRegistration(payload),
    async () => {
      const registration = await request<Registration>({
        data: payload,
        method: 'POST',
        path: '/api/registrations',
      });
      const [detail] = await attachActivities([registration]);
      return detail;
    }
  );
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
    postsCount: 0,
    remainingCardTimes: currentCard?.remainingCount || 0,
    defaultProfileName: profiles.find((item) => item.isDefault)?.nickname,
    likesReceived: 0,
  };
}
