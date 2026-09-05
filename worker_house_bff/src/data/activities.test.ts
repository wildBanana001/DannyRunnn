import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';
import type { ActivityRecord } from '../types/index.js';

process.env.NODE_ENV = 'test';
process.env.MODE = 'mock';
process.env.SHOP_ORDER_STORAGE = 'file';
const activityTestDirectory = mkdtempSync(path.join(tmpdir(), 'worker-house-activities-'));
const activityTestStore = path.join(activityTestDirectory, 'activities.store.json');
copyFileSync(fileURLToPath(new URL('./activities.store.json', import.meta.url)), activityTestStore);
process.env.ACTIVITY_CATALOG_FILE = activityTestStore;
after(() => rmSync(activityTestDirectory, { force: true, recursive: true }));

const {
  deleteActivity,
  getActivityById,
  listActivities,
  upsertActivity,
} = await import('./activities.js');

function completeActivityInput(overrides: Partial<ActivityRecord> = {}): Partial<ActivityRecord> {
  const existing = listActivities()[0];
  assert.ok(existing);
  const {
    createdAt: _createdAt,
    id: _id,
    signups: _signups,
    status: _status,
    updatedAt: _updatedAt,
    ...writeable
  } = existing;
  return {
    ...writeable,
    title: '严格活动目录测试',
    ...overrides,
  };
}

test('creating an activity requires a complete payload and ignores a caller-supplied existing ID', () => {
  const existing = listActivities()[0];
  assert.ok(existing);
  const originalTitle = existing.title;

  const created = upsertActivity(undefined, completeActivityInput({
    id: existing.id,
    title: '不得覆盖已有活动',
  }));

  try {
    assert.notEqual(created.id, existing.id);
    assert.equal(getActivityById(existing.id)?.title, originalTitle);
    assert.equal(getActivityById(created.id)?.title, '不得覆盖已有活动');
  } finally {
    deleteActivity(created.id);
  }
});

test('rejects incomplete or malformed sale-critical activity fields without persisting them', () => {
  const originalCount = listActivities().length;
  const invalidInputs: Partial<ActivityRecord>[] = [
    completeActivityInput({ enabled: undefined }),
    completeActivityInput({ enabled: null as never }),
    completeActivityInput({ price: undefined }),
    completeActivityInput({ price: null as never }),
    completeActivityInput({ price: Number.NaN }),
    completeActivityInput({ price: Number.POSITIVE_INFINITY }),
    completeActivityInput({ price: -1 }),
    completeActivityInput({ price: 0.001 }),
    completeActivityInput({ originalPrice: undefined }),
    completeActivityInput({ currentParticipants: undefined }),
    completeActivityInput({ maxParticipants: undefined }),
    completeActivityInput({ maxParticipants: 0 }),
    completeActivityInput({ maxParticipants: 1.5 }),
    completeActivityInput({ cardEligible: undefined }),
    completeActivityInput({
      cover: '',
      coverImage: '',
      covers: [],
      gallery: [],
    }),
    completeActivityInput({ gallery: 'not-an-array' as never }),
    completeActivityInput({ gallery: [123 as never] }),
    completeActivityInput({ coverImage: 'activity-asset://legacy-cover' }),
    completeActivityInput({ gallery: ['data:image/png;base64,unsafe'] }),
    completeActivityInput({ startDate: '2026-02-30' }),
    completeActivityInput({ startTime: '24:00' }),
    completeActivityInput({
      endDate: '2026-08-08',
      endTime: '09:00',
      startDate: '2026-08-08',
      startTime: '10:00',
    }),
  ];

  for (const input of invalidInputs) {
    assert.throws(
      () => upsertActivity(undefined, input),
      (error: unknown) => (error as { code?: string }).code === 'ACTIVITY_CATALOG_INVALID',
    );
  }
  assert.equal(listActivities().length, originalCount);
});

test('partial updates preserve a disabled activity and explicit invalid values do not mutate it', () => {
  const created = upsertActivity(undefined, completeActivityInput({
    enabled: false,
    title: '保持下架状态',
  }));

  try {
    const updated = upsertActivity(created.id, { title: '只更新标题' });
    assert.ok(updated);
    assert.equal(updated.enabled, false);
    assert.equal(updated.price, created.price);
    assert.equal(updated.maxParticipants, created.maxParticipants);

    assert.throws(
      () => upsertActivity(created.id, { enabled: null as never }),
      (error: unknown) => (error as { code?: string }).code === 'ACTIVITY_CATALOG_INVALID',
    );
    assert.equal(getActivityById(created.id)?.enabled, false);
    assert.equal(getActivityById(created.id)?.title, '只更新标题');
  } finally {
    deleteActivity(created.id);
  }
});
