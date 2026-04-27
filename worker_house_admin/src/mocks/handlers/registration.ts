import dayjs from 'dayjs';
import { http, HttpResponse } from 'msw';
import { listRegistrations } from '@/mocks/db/registrations';

export const registrationHandlers = [
  http.get('/api/admin/registrations', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '10');
    const activityId = url.searchParams.get('activityId');
    const status = url.searchParams.get('status');

    let records = listRegistrations();

    if (activityId) {
      records = records.filter((registration) => registration.activityId === activityId);
    }

    if (status) {
      records = records.filter((registration) => registration.status === status);
    }

    records = records.sort(
      (first, second) => dayjs(second.registeredAt).valueOf() - dayjs(first.registeredAt).valueOf(),
    );

    const start = (page - 1) * pageSize;

    return HttpResponse.json({
      list: records.slice(start, start + pageSize),
      total: records.length,
    });
  }),
];
