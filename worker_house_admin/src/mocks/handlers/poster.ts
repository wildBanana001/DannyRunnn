import dayjs from 'dayjs';
import { http, HttpResponse } from 'msw';
import {
  createPosterRecord,
  deletePosterRecord,
  findPosterById,
  listPosters,
  reorderPosterRecords,
  updatePosterRecord,
} from '@/mocks/db/posters';
import type { Poster } from '@/types/poster';

export const posterHandlers = [
  http.get('/api/posters', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '10');
    const enabledParam = url.searchParams.get('enabled');

    let records = listPosters();

    if (enabledParam === 'true') {
      records = records.filter((poster) => poster.enabled);
    } else if (enabledParam === 'false') {
      records = records.filter((poster) => !poster.enabled);
    }

    records = records.sort((first, second) => {
      if (first.sort !== second.sort) {
        return first.sort - second.sort;
      }

      return dayjs(second.createdAt).valueOf() - dayjs(first.createdAt).valueOf();
    });

    const start = (page - 1) * pageSize;
    const list = records.slice(start, start + pageSize);

    return HttpResponse.json({
      list,
      total: records.length,
    });
  }),
  http.get('/api/posters/:id', ({ params }) => {
    const poster = findPosterById(String(params.id));

    if (!poster) {
      return HttpResponse.json({ message: '海报不存在' }, { status: 404 });
    }

    return HttpResponse.json(poster);
  }),
  http.post('/api/posters', async ({ request }) => {
    const payload = (await request.json()) as Omit<Poster, 'id' | 'createdAt' | 'updatedAt'>;
    const poster = createPosterRecord(payload);
    return HttpResponse.json(poster);
  }),
  http.put('/api/posters/:id', async ({ params, request }) => {
    const payload = (await request.json()) as Poster;
    const poster = updatePosterRecord(String(params.id), payload);

    if (!poster) {
      return HttpResponse.json({ message: '海报不存在' }, { status: 404 });
    }

    return HttpResponse.json(poster);
  }),
  http.delete('/api/posters/:id', ({ params }) => {
    const success = deletePosterRecord(String(params.id));

    if (!success) {
      return HttpResponse.json({ message: '海报不存在' }, { status: 404 });
    }

    return HttpResponse.json({ success: true });
  }),
  http.put('/api/posters/reorder', async ({ request }) => {
    const payload = (await request.json()) as { ids?: string[] };
    const ids = payload.ids ?? [];

    reorderPosterRecords(ids);
    return HttpResponse.json({ success: true });
  }),
];
