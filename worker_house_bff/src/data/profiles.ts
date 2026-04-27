import { randomUUID } from 'node:crypto';
import { profileSeedData } from './seed.js';
import { clone, memoryStore, now } from './store.js';
import type { Profile, ProfileGender, ProfileSnapshot } from '../types/index.js';

if (memoryStore.profiles.length === 0) {
  memoryStore.profiles = clone(profileSeedData);
}

interface ProfileMutationInput {
  ageRange?: string;
  city?: string;
  gender?: ProfileGender;
  industry?: string;
  introduction?: string;
  isDefault?: boolean;
  nickname?: string;
  occupation?: string;
  phone?: string;
  socialGoal?: string;
  tags?: string[];
  wechatName?: string;
}

function createId() {
  return `profile-${randomUUID().slice(0, 8)}`;
}

function sanitizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeOptionalString(value: unknown) {
  const normalized = sanitizeString(value);
  return normalized || undefined;
}

function sanitizeTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => sanitizeString(item))
    .filter(Boolean);
}

function normalizeProfile(openid: string, input: ProfileMutationInput, current?: Profile): Profile {
  const timestamp = now();
  const gender = input.gender ?? current?.gender ?? 'other';

  return {
    id: current?.id ?? createId(),
    openid,
    nickname: sanitizeString(input.nickname) || current?.nickname || '未命名档案',
    gender,
    ageRange: sanitizeString(input.ageRange) || current?.ageRange || '',
    industry: sanitizeString(input.industry) || current?.industry || '',
    occupation: sanitizeString(input.occupation) || current?.occupation || '',
    city: sanitizeString(input.city) || current?.city || '',
    socialGoal: sanitizeString(input.socialGoal) || current?.socialGoal || '',
    introduction: sanitizeString(input.introduction) || current?.introduction || '',
    wechatName: sanitizeString(input.wechatName) || current?.wechatName || '',
    phone: input.phone === undefined ? current?.phone : sanitizeOptionalString(input.phone),
    tags: input.tags === undefined ? current?.tags ?? [] : sanitizeTags(input.tags),
    isDefault: input.isDefault ?? current?.isDefault ?? false,
    createdAt: current?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function sortProfiles(list: Profile[]) {
  return list.sort((first, second) => {
    if (first.isDefault !== second.isDefault) {
      return Number(second.isDefault) - Number(first.isDefault);
    }
    return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
  });
}

function replaceProfilesForOpenid(openid: string, nextProfiles: Profile[]) {
  const otherProfiles = memoryStore.profiles.filter((item) => item.openid !== openid);
  memoryStore.profiles = [...otherProfiles, ...nextProfiles];
}

export function listProfilesByOpenid(openid: string) {
  return clone(sortProfiles(memoryStore.profiles.filter((item) => item.openid === openid)));
}

export function getProfileById(openid: string, profileId: string) {
  const record = memoryStore.profiles.find((item) => item.openid === openid && item.id === profileId) ?? null;
  return clone(record);
}

export function getProfileByIdUnsafe(profileId: string) {
  const record = memoryStore.profiles.find((item) => item.id === profileId) ?? null;
  return clone(record);
}

export function createProfile(openid: string, input: ProfileMutationInput) {
  const currentProfiles = memoryStore.profiles.filter((item) => item.openid === openid);
  const nextRecord = normalizeProfile(openid, {
    ...input,
    isDefault: currentProfiles.length === 0 ? true : Boolean(input.isDefault),
  });

  const nextProfiles = currentProfiles.map((item) => ({
    ...item,
    isDefault: nextRecord.isDefault ? false : item.isDefault,
  }));

  replaceProfilesForOpenid(openid, sortProfiles([nextRecord, ...nextProfiles]));
  return clone(nextRecord);
}

export function updateProfile(openid: string, profileId: string, input: ProfileMutationInput) {
  const currentProfiles = memoryStore.profiles.filter((item) => item.openid === openid);
  const current = currentProfiles.find((item) => item.id === profileId);

  if (!current) {
    return null;
  }

  const nextRecord = normalizeProfile(openid, input, current);
  const nextProfiles = currentProfiles.map((item) => {
    if (item.id === profileId) {
      return nextRecord;
    }

    if (nextRecord.isDefault) {
      return { ...item, isDefault: false };
    }

    return item;
  });

  replaceProfilesForOpenid(openid, sortProfiles(nextProfiles));
  return clone(nextRecord);
}

export function deleteProfile(openid: string, profileId: string) {
  const currentProfiles = memoryStore.profiles.filter((item) => item.openid === openid);
  const nextProfiles = currentProfiles.filter((item) => item.id !== profileId);

  if (nextProfiles.length === currentProfiles.length) {
    return false;
  }

  if (nextProfiles.length > 0 && !nextProfiles.some((item) => item.isDefault)) {
    nextProfiles[0] = { ...nextProfiles[0], isDefault: true, updatedAt: now() };
  }

  replaceProfilesForOpenid(openid, sortProfiles(nextProfiles));
  return true;
}

export function setDefaultProfile(openid: string, profileId: string) {
  const currentProfiles = memoryStore.profiles.filter((item) => item.openid === openid);
  if (!currentProfiles.some((item) => item.id === profileId)) {
    return null;
  }

  const timestamp = now();
  const nextProfiles = currentProfiles.map((item) => ({
    ...item,
    isDefault: item.id === profileId,
    updatedAt: item.id === profileId ? timestamp : item.updatedAt,
  }));

  replaceProfilesForOpenid(openid, sortProfiles(nextProfiles));
  return clone(nextProfiles.find((item) => item.id === profileId) ?? null);
}

export function resolveProfileForRegistration(openid: string, profileId?: string) {
  if (profileId) {
    return getProfileById(openid, profileId);
  }

  const profiles = listProfilesByOpenid(openid);
  return profiles.find((item) => item.isDefault) ?? profiles[0] ?? null;
}

export function buildProfileSnapshot(profile: Profile): ProfileSnapshot {
  return {
    nickname: profile.nickname,
    gender: profile.gender,
    ageRange: profile.ageRange,
    industry: profile.industry,
    occupation: profile.occupation,
    city: profile.city,
    socialGoal: profile.socialGoal,
    introduction: profile.introduction,
  };
}
