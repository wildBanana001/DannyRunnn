import dayjs from 'dayjs';
import { http, HttpResponse } from 'msw';
import { listProfiles } from '@/mocks/db/profiles';

export const profileHandlers = [
  http.get('/api/profiles', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '10');

    const records = listProfiles().sort(
      (first, second) => dayjs(second.createdAt).valueOf() - dayjs(first.createdAt).valueOf(),
    );
    const start = (page - 1) * pageSize;

    return HttpResponse.json({
      list: records.slice(start, start + pageSize),
      total: records.length,
    });
  }),
];
