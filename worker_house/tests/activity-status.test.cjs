const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getActivityEndTimestamp,
  resolveActivityStatus,
  selectActivitiesByStatus,
} = require('../src/utils/activityStatus.ts');

const createActivity = (overrides = {}) => ({
  id: 'activity-test',
  title: '测试活动',
  description: '',
  fullDescription: '',
  coverImage: '',
  gallery: [],
  startDate: '2026-08-09',
  endDate: '2026-08-09',
  startTime: '16:00',
  endTime: '20:00',
  price: 0,
  maxParticipants: 10,
  currentParticipants: 0,
  status: 'ongoing',
  category: '',
  tags: [],
  hostId: '',
  hostName: '',
  hostAvatar: '',
  hostDescription: '',
  requirements: [],
  includes: [],
  refundPolicy: '',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
});

test('活动在北京时间结束前仍归类为进行中', () => {
  const activity = createActivity();
  const oneMillisecondBeforeEnd = Date.parse('2026-08-09T19:59:59.999+08:00');

  assert.equal(resolveActivityStatus(activity, oneMillisecondBeforeEnd), 'ongoing');
});

test('活动到达北京时间结束时刻后立即归类为历史活动', () => {
  const activity = createActivity();
  const exactEndTime = Date.parse('2026-08-09T20:00:00+08:00');

  assert.equal(resolveActivityStatus(activity, exactEndTime), 'ended');
});

test('跨日活动使用 endDate 而不是 startDate 判断是否结束', () => {
  const activity = createActivity({
    startDate: '2026-08-09',
    endDate: '2026-08-10',
    endTime: '01:00',
  });

  assert.equal(resolveActivityStatus(activity, Date.parse('2026-08-09T23:00:00+08:00')), 'ongoing');
  assert.equal(resolveActivityStatus(activity, Date.parse('2026-08-10T01:00:00+08:00')), 'ended');
});

test('无效结束时间按当天 23:59 兜底', () => {
  const activity = createActivity({ endTime: '99:99' });

  assert.equal(getActivityEndTimestamp(activity), Date.parse('2026-08-09T23:59:00+08:00'));
});

test('分类忽略接口中已过期的静态 status 并按日期重新归档', () => {
  const expired = createActivity({ id: 'expired', status: 'ongoing' });
  const future = createActivity({
    id: 'future',
    startDate: '2026-08-22',
    endDate: '2026-08-22',
    status: 'ended',
  });
  const now = Date.parse('2026-08-18T12:00:00+08:00');

  assert.deepEqual(selectActivitiesByStatus([expired, future], 'ended', now).map(({ id }) => id), ['expired']);
  assert.deepEqual(selectActivitiesByStatus([expired, future], 'ongoing', now).map(({ id }) => id), ['future']);
});
