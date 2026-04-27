import dayjs from 'dayjs';
import { http, HttpResponse } from 'msw';
import {
  createActivityRecord,
  deleteActivityRecord,
  findActivityById,
  listActivities,
  updateActivityRecord,
} from '@/mocks/db/activities';
import type { Activity } from '@/types/activity';

export const activityHandlers = [
  http.get('/api/activities', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '10');
    const status = url.searchParams.get('status');
    const keyword = url.searchParams.get('keyword')?.trim().toLowerCase();

    let records = listActivities();

    if (status) {
      records = records.filter((activity) => activity.status === status);
    }

    if (keyword) {
      records = records.filter((activity) => activity.title.toLowerCase().includes(keyword));
    }

    records = records.sort(
      (first, second) => dayjs(second.createdAt).valueOf() - dayjs(first.createdAt).valueOf(),
    );

    const start = (page - 1) * pageSize;
    const list = records.slice(start, start + pageSize);

    return HttpResponse.json({
      list,
      total: records.length,
    });
  }),
  http.get('/api/activities/:id', ({ params }) => {
    const activity = findActivityById(String(params.id));

    if (!activity) {
      return HttpResponse.json({ message: '活动不存在' }, { status: 404 });
    }

    return HttpResponse.json(activity);
  }),
  http.post('/api/activities', async ({ request }) => {
    const payload = (await request.json()) as Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>;
    const activity = createActivityRecord(payload);
    return HttpResponse.json(activity);
  }),
  http.put('/api/activities/:id', async ({ params, request }) => {
    const payload = (await request.json()) as Activity;
    const activity = updateActivityRecord(String(params.id), payload);

    if (!activity) {
      return HttpResponse.json({ message: '活动不存在' }, { status: 404 });
    }

    return HttpResponse.json(activity);
  }),
  http.delete('/api/activities/:id', ({ params }) => {
    const success = deleteActivityRecord(String(params.id));

    if (!success) {
      return HttpResponse.json({ message: '活动不存在' }, { status: 404 });
    }

    return HttpResponse.json({ success: true });
  }),
];
