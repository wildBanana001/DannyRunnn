import Taro from '@tarojs/taro';
import { getPaymentApiMode, requestWithMode } from './request';

export type AdminFulfillmentTaskKind = 'activity' | 'shop';
export type AdminFulfillmentTaskAction = 'fulfill' | 'retry';

export interface AdminIdentity {
  isAdmin: boolean;
  openid: string;
}

export interface AdminFulfillmentTask {
  action: AdminFulfillmentTaskAction;
  amount: number;
  createdAt: string;
  fulfillmentLabel: string;
  fulfillmentStatus: 'pending' | 'fulfilled';
  id: string;
  kind: AdminFulfillmentTaskKind;
  paidAt: string;
  participantContact: string;
  participantName: string;
  quantity: number;
  remark: string;
  title: string;
  unitLabel: string;
  wechatShippingAttempts: number;
  wechatShippingError: string;
  wechatShippingStatus: 'not_required' | 'pending' | 'reporting' | 'reported' | 'failed';
}

const MOCK_OPENID = 'mock_openid_001';
const MOCK_TASK_STORAGE_KEY = 'worker-house-admin-fulfillment-tasks-v1';

const mockTasks: AdminFulfillmentTask[] = [
  {
    action: 'fulfill',
    amount: 1,
    createdAt: '2026-08-09T11:58:00.000Z',
    fulfillmentLabel: '现场参与',
    fulfillmentStatus: 'pending',
    id: 'WA-MOCK-ACTIVITY-001',
    kind: 'activity',
    paidAt: '2026-08-09T12:00:00.000Z',
    participantContact: 'Linkaifeng · 13800000000',
    participantName: '凯锋',
    quantity: 1,
    remark: '',
    title: 'Deeptalk｜幸福的奥义',
    unitLabel: '位',
    wechatShippingAttempts: 0,
    wechatShippingError: '',
    wechatShippingStatus: 'pending',
  },
  {
    action: 'retry',
    amount: 1,
    createdAt: '2026-08-09T10:30:00.000Z',
    fulfillmentLabel: '到店享用',
    fulfillmentStatus: 'fulfilled',
    id: 'WH-MOCK-SHOP-001',
    kind: 'shop',
    paidAt: '2026-08-09T10:31:00.000Z',
    participantContact: '',
    participantName: '到店用户',
    quantity: 1,
    remark: '少冰',
    title: '落日气泡 Highball',
    unitLabel: '杯',
    wechatShippingAttempts: 1,
    wechatShippingError: '微信接口暂时不可用，请重试',
    wechatShippingStatus: 'failed',
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getMockTasks() {
  const cached = Taro.getStorageSync<AdminFulfillmentTask[] | null>(MOCK_TASK_STORAGE_KEY);
  if (Array.isArray(cached)) {
    return clone(cached);
  }
  const initialTasks = clone(mockTasks);
  Taro.setStorageSync(MOCK_TASK_STORAGE_KEY, initialTasks);
  return initialTasks;
}

export async function fetchAdminIdentity(): Promise<AdminIdentity> {
  const apiMode = getPaymentApiMode();
  if (apiMode === 'mock') {
    return { isAdmin: true, openid: MOCK_OPENID };
  }

  return requestWithMode<AdminIdentity>(apiMode, {
    method: 'POST',
    path: '/api/admin-mini/check',
  });
}

export async function fetchAdminFulfillmentTasks(): Promise<AdminFulfillmentTask[]> {
  const apiMode = getPaymentApiMode();
  if (apiMode === 'mock') {
    return getMockTasks();
  }

  const response = await requestWithMode<{ list: AdminFulfillmentTask[] }>(apiMode, {
    path: '/api/admin-mini/fulfillment-tasks',
  });
  return response.list || [];
}

export async function completeAdminFulfillmentTask(task: AdminFulfillmentTask): Promise<AdminFulfillmentTask> {
  const apiMode = getPaymentApiMode();
  if (apiMode === 'mock') {
    const tasks = getMockTasks();
    const current = tasks.find((item) => item.id === task.id && item.kind === task.kind);
    if (!current) {
      throw new Error('待核销订单不存在或已经处理');
    }
    Taro.setStorageSync(
      MOCK_TASK_STORAGE_KEY,
      tasks.filter((item) => item.id !== task.id || item.kind !== task.kind),
    );
    return {
      ...current,
      action: 'retry',
      fulfillmentStatus: 'fulfilled',
      wechatShippingError: '',
      wechatShippingStatus: current.wechatShippingStatus === 'not_required' ? 'not_required' : 'reported',
    };
  }

  const response = await requestWithMode<{ data: AdminFulfillmentTask }>(apiMode, {
    method: 'POST',
    path: `/api/admin-mini/fulfillment-tasks/${task.kind}/${encodeURIComponent(task.id)}/complete`,
  });
  return response.data;
}
