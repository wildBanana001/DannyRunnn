import dayjs from 'dayjs';
import { http, HttpResponse } from 'msw';
import { listCardOrders } from '@/mocks/db/cardOrders';

export const cardOrderHandlers = [
  http.get('/api/admin/card-orders', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '10');

    const records = listCardOrders().sort(
      (first, second) => dayjs(second.purchasedAt).valueOf() - dayjs(first.purchasedAt).valueOf(),
    );
    const start = (page - 1) * pageSize;

    return HttpResponse.json({
      list: records.slice(start, start + pageSize),
      total: records.length,
    });
  }),
];
