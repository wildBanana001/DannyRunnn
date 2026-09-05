import type { Activity, Host, Venue } from '@/types';
import type { ActivityDisplayStatus } from '@/utils/activityStatus';

// Non-mock bundles resolve '@/data/activities' to this module. Keep every export
// structurally compatible without shipping schedules, prices, images, or other seeds.
export const allActivities: Activity[] = [];

export const getLocalActivitiesByStatus = (
  _status: ActivityDisplayStatus,
  _now = Date.now(),
): Activity[] => [];

export const ongoingActivities: Activity[] = [];
export const upcomingActivities: Activity[] = [];

// These legacy single-value exports must never drive a remote build. Undefined
// preserves the export surface while making accidental runtime use fail closed.
export const featuredActivity = undefined as unknown as Activity;
export const hostInfo = undefined as unknown as Host;
export const venueInfo = undefined as unknown as Venue;
