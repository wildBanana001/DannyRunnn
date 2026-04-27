import dayjs from 'dayjs';
import { http, HttpResponse } from 'msw';
import { deletePostRecord, listPosts, updatePostPinState } from '@/mocks/db/posts';

export const treeholeHandlers = [
  http.get('/api/posts', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '10');
    const keyword = url.searchParams.get('keyword')?.trim().toLowerCase();
    const onlyPinned = url.searchParams.get('onlyPinned') === 'true';
    const colorsParam = url.searchParams.get('colors');
    const colors =
      colorsParam
        ?.split(',')
        .map((item) => item.trim())
        .filter(Boolean) ?? [];

    let records = listPosts();

    if (keyword) {
      records = records.filter((post) => post.content.toLowerCase().includes(keyword));
    }

    if (onlyPinned) {
      records = records.filter((post) => post.isPinned);
    }

    if (colors.length) {
      records = records.filter((post) => post.color && colors.includes(post.color));
    }

    records = records.sort((first, second) => {
      if (first.isPinned !== second.isPinned) {
        return Number(second.isPinned) - Number(first.isPinned);
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
  http.delete('/api/posts/:id', ({ params }) => {
    const success = deletePostRecord(String(params.id));

    if (!success) {
      return HttpResponse.json({ message: '帖子不存在' }, { status: 404 });
    }

    return HttpResponse.json({ success: true });
  }),
  http.patch('/api/posts/:id/pin', async ({ params, request }) => {
    const payload = (await request.json()) as { isPinned?: boolean };
    const post = updatePostPinState(String(params.id), Boolean(payload.isPinned));

    if (!post) {
      return HttpResponse.json({ message: '帖子不存在' }, { status: 404 });
    }

    return HttpResponse.json(post);
  }),
];
