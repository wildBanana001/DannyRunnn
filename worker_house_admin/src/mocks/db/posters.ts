import dayjs from 'dayjs';
import type { Poster } from '@/types/poster';

export const posterSeedData: Poster[] = [
  {
    id: 'poster-001',
    title: 'Worker House 空间日常',
    coverImage: 'https://picsum.photos/id/1015/600/800',
    detailImages: [
      'https://picsum.photos/id/1015/800/600',
      'https://picsum.photos/id/1016/800/600',
      'https://picsum.photos/id/1018/800/600',
    ],
    enabled: true,
    sort: 0,
    createdAt: '2026-04-20T12:00:00Z',
    updatedAt: '2026-04-20T12:00:00Z',
  },
  {
    id: 'poster-002',
    title: '活动回顾与预告',
    coverImage: 'https://picsum.photos/id/1025/600/800',
    detailImages: [
      'https://picsum.photos/id/1025/800/600',
      'https://picsum.photos/id/1027/800/600',
    ],
    enabled: true,
    sort: 1,
    createdAt: '2026-04-21T10:00:00Z',
    updatedAt: '2026-04-21T10:00:00Z',
  },
  {
    id: 'poster-003',
    title: '慢下来生活提案',
    coverImage: 'https://picsum.photos/id/1035/600/800',
    detailImages: [
      'https://picsum.photos/id/1035/800/600',
      'https://picsum.photos/id/1038/800/600',
    ],
    enabled: false,
    sort: 2,
    createdAt: '2026-04-22T15:30:00Z',
    updatedAt: '2026-04-22T15:30:00Z',
  },
];

let posters = [...posterSeedData];

export function resetPosters() {
  posters = [...posterSeedData];
}

export function listPosters() {
  return [...posters];
}

export function findPosterById(id: string) {
  return posters.find((poster) => poster.id === id) ?? null;
}

export function createPosterRecord(payload: Omit<Poster, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = dayjs().toISOString();
  const poster: Poster = {
    ...payload,
    id: `poster-${now}`,
    createdAt: now,
    updatedAt: now,
  };

  posters = [...posters, poster];
  return poster;
}

export function updatePosterRecord(id: string, payload: Poster) {
  const exists = posters.some((poster) => poster.id === id);

  if (!exists) {
    return null;
  }

  const next: Poster = {
    ...payload,
    id,
    updatedAt: dayjs().toISOString(),
  };

  posters = posters.map((poster) => (poster.id === id ? next : poster));
  return next;
}

export function deletePosterRecord(id: string) {
  const exists = posters.some((poster) => poster.id === id);
  posters = posters.filter((poster) => poster.id !== id);
  return exists;
}

export function reorderPosterRecords(ids: string[]) {
  const map = new Map(posters.map((poster) => [poster.id, poster] as const));
  const ordered: Poster[] = [];

  ids.forEach((id, index) => {
    const record = map.get(id);

    if (record) {
      ordered.push({
        ...record,
        sort: index,
        updatedAt: dayjs().toISOString(),
      });
      map.delete(id);
    }
  });

  const remaining = Array.from(map.values()).sort((first, second) => first.sort - second.sort);

  posters = [...ordered, ...remaining].map((poster, index) => ({
    ...poster,
    sort: index,
  }));

  return posters;
}
