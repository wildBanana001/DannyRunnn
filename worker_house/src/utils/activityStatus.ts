import type { Activity } from '../types';

export type ActivityDisplayStatus = 'ongoing' | 'ended';

export interface ActivityStatusResolutionOptions {
  trustProvidedStatus?: boolean;
}

const SHENZHEN_TIMEZONE_OFFSET = '+08:00';
const DEFAULT_START_TIME = '00:00';
const DEFAULT_END_TIME = '23:59';

const normalizeClockTime = (value: string | undefined, fallback: string): string => {
  const matched = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value?.trim() || '');
  if (!matched) {
    return fallback;
  }

  const hour = Number(matched[1]);
  const minute = Number(matched[2]);
  if (hour > 23 || minute > 59) {
    return fallback;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const buildActivityTimestamp = (date: string, time: string): number => {
  return Date.parse(`${date}T${time}:00${SHENZHEN_TIMEZONE_OFFSET}`);
};

export const getActivityEndTimestamp = (
  activity: Pick<Activity, 'startDate' | 'endDate' | 'endTime'>,
): number | null => {
  const endDate = activity.endDate?.trim() || activity.startDate?.trim();
  if (!endDate) {
    return null;
  }

  const timestamp = buildActivityTimestamp(
    endDate,
    normalizeClockTime(activity.endTime, DEFAULT_END_TIME),
  );
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const resolveActivityStatus = (
  activity: Pick<Activity, 'startDate' | 'endDate' | 'endTime'> & Partial<Pick<Activity, 'status'>>,
  now = Date.now(),
  { trustProvidedStatus = false }: ActivityStatusResolutionOptions = {},
): Activity['status'] => {
  if (
    trustProvidedStatus
    && (activity.status === 'upcoming' || activity.status === 'ongoing' || activity.status === 'ended')
  ) {
    return activity.status;
  }

  const endTimestamp = getActivityEndTimestamp(activity);
  return endTimestamp !== null && now >= endTimestamp ? 'ended' : 'ongoing';
};

export const refreshActivityStatus = <T extends Activity>(
  activity: T,
  now = Date.now(),
  options: ActivityStatusResolutionOptions = {},
): T => ({
  ...activity,
  status: resolveActivityStatus(activity, now, options),
});

const getActivityStartTimestamp = (
  activity: Pick<Activity, 'startDate' | 'startTime'>,
): number => {
  const timestamp = buildActivityTimestamp(
    activity.startDate,
    normalizeClockTime(activity.startTime, DEFAULT_START_TIME),
  );
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const selectActivitiesByStatus = <T extends Activity>(
  activities: T[],
  status: ActivityDisplayStatus,
  now = Date.now(),
  options: ActivityStatusResolutionOptions = {},
): T[] => {
  const direction = status === 'ended' ? -1 : 1;

  return activities
    .map((activity) => refreshActivityStatus(activity, now, options))
    .filter((activity) => activity.status === status)
    .sort((first, second) => {
      const timestampDifference = getActivityStartTimestamp(first) - getActivityStartTimestamp(second);
      if (timestampDifference !== 0) {
        return timestampDifference * direction;
      }
      return (first.sort ?? 0) - (second.sort ?? 0);
    });
};
