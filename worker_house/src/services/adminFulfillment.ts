import {
  completeMockAdminFulfillmentTask,
  getMockAdminFulfillmentTasks,
  getMockAdminIdentity,
} from '@/data/mock-member';
import type { AdminFulfillmentTask, AdminIdentity } from '@/types/adminFulfillment';
import { getApiMode, requestWithMode } from './request';

export type {
  AdminFulfillmentTask,
  AdminFulfillmentTaskAction,
  AdminFulfillmentTaskKind,
  AdminIdentity,
} from '@/types/adminFulfillment';

export async function fetchAdminIdentity(): Promise<AdminIdentity> {
  const apiMode = getApiMode();
  if (apiMode === 'mock') {
    return getMockAdminIdentity();
  }

  return requestWithMode<AdminIdentity>(apiMode, {
    method: 'POST',
    path: '/api/admin-mini/check',
  });
}

export async function fetchAdminFulfillmentTasks(): Promise<AdminFulfillmentTask[]> {
  const apiMode = getApiMode();
  if (apiMode === 'mock') {
    return getMockAdminFulfillmentTasks();
  }

  const response = await requestWithMode<{ list: AdminFulfillmentTask[] }>(apiMode, {
    path: '/api/admin-mini/fulfillment-tasks',
  });
  return response.list || [];
}

export async function completeAdminFulfillmentTask(task: AdminFulfillmentTask): Promise<AdminFulfillmentTask> {
  const apiMode = getApiMode();
  if (apiMode === 'mock') {
    return completeMockAdminFulfillmentTask(task);
  }

  const response = await requestWithMode<{ data: AdminFulfillmentTask }>(apiMode, {
    method: 'POST',
    path: `/api/admin-mini/fulfillment-tasks/${task.kind}/${encodeURIComponent(task.id)}/complete`,
  });
  return response.data;
}
