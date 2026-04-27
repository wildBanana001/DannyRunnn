import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface UserRecord {
  openid: string;
  nickname: string;
  avatar: string;
  createdAt: string;
  updatedAt: string;
}

interface UserStoreState {
  users: UserRecord[];
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'users.store.json');

const userStore: UserStoreState = {
  users: [],
};

function now() {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sanitizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function loadUsers() {
  if (userStore.users.length > 0) {
    return;
  }

  if (!existsSync(storageFilePath)) {
    userStore.users = [];
    return;
  }

  try {
    const rawContent = readFileSync(storageFilePath, 'utf-8');
    const parsed = JSON.parse(rawContent) as UserRecord[];
    if (!Array.isArray(parsed)) {
      throw new Error('用户数据格式错误');
    }

    userStore.users = parsed.map((item) => ({
      openid: sanitizeString(item.openid),
      nickname: sanitizeString(item.nickname),
      avatar: sanitizeString(item.avatar),
      createdAt: sanitizeString(item.createdAt) || now(),
      updatedAt: sanitizeString(item.updatedAt) || now(),
    }));
  } catch {
    userStore.users = [];
  }
}

function persistUsers() {
  mkdirSync(path.dirname(storageFilePath), { recursive: true });
  writeFileSync(storageFilePath, JSON.stringify(userStore.users, null, 2), 'utf-8');
}

export function listUsers() {
  loadUsers();
  return clone(userStore.users);
}

export function getUserByOpenid(openid: string) {
  loadUsers();
  const record = userStore.users.find((item) => item.openid === openid);
  return record ? clone(record) : null;
}

interface UpsertPatch {
  nickname?: string;
  avatar?: string;
}

export function upsertUser(openid: string, patch: UpsertPatch) {
  loadUsers();
  const normalizedOpenid = sanitizeString(openid);
  if (!normalizedOpenid) {
    throw new Error('openid 不能为空');
  }

  const nowTime = now();
  const index = userStore.users.findIndex((item) => item.openid === normalizedOpenid);

  if (index === -1) {
    const user: UserRecord = {
      openid: normalizedOpenid,
      nickname: sanitizeString(patch.nickname),
      avatar: sanitizeString(patch.avatar),
      createdAt: nowTime,
      updatedAt: nowTime,
    };

    userStore.users.push(user);
    persistUsers();
    return { user: clone(user), isNew: true } as const;
  }

  const current = userStore.users[index];
  const next: UserRecord = {
    ...current,
    nickname: patch.nickname !== undefined ? sanitizeString(patch.nickname) : current.nickname,
    avatar: patch.avatar !== undefined ? sanitizeString(patch.avatar) : current.avatar,
    updatedAt: nowTime,
  };

  userStore.users[index] = next;
  persistUsers();
  return { user: clone(next), isNew: false } as const;
}
