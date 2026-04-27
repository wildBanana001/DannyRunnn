import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CardPackage, CardPackageStatus } from '../types/index.js';

interface CardPackageStoreState {
  packages: CardPackage[];
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'cardPackages.store.json');

const defaultCardPackageSeed: CardPackage[] = [
  {
    id: 'card-package-3x',
    name: '社畜次卡 3 次装',
    totalCount: 3,
    price: 399,
    perUseMaxOffset: 148,
    validDays: 180,
    status: 'active',
    sortOrder: 1,
    createdAt: '2026-04-26T15:00:00.000Z',
    updatedAt: '2026-04-26T15:00:00.000Z',
  },
];

const cardPackageStore: CardPackageStoreState = {
  packages: [],
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now() {
  return new Date().toISOString();
}

function createCardPackageId() {
  return `cardpkg-${randomUUID().slice(0, 8)}`;
}

function sanitizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeNumber(value: unknown, fallback: number) {
  const nextValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function normalizeStatus(value: unknown, fallback: CardPackageStatus = 'active'): CardPackageStatus {
  return sanitizeString(value) === 'archived' ? 'archived' : fallback;
}

function sortCardPackages(list: CardPackage[]) {
  return [...list].sort((first, second) => {
    if (first.sortOrder !== second.sortOrder) {
      return first.sortOrder - second.sortOrder;
    }
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  });
}

function normalizeCardPackage(record: Partial<CardPackage>, index = 0): CardPackage {
  const createdAt = sanitizeString(record.createdAt) || now();

  return {
    id: sanitizeString(record.id) || createCardPackageId(),
    name: sanitizeString(record.name) || '未命名次卡套餐',
    totalCount: Math.max(1, Math.floor(sanitizeNumber(record.totalCount, 1))),
    price: Math.max(0, sanitizeNumber(record.price, 0)),
    perUseMaxOffset: Math.max(0, sanitizeNumber(record.perUseMaxOffset, 0)),
    validDays: Math.max(1, Math.floor(sanitizeNumber(record.validDays, 30))),
    status: normalizeStatus(record.status, 'active'),
    sortOrder: Math.max(1, Math.floor(sanitizeNumber(record.sortOrder, index + 1))),
    createdAt,
    updatedAt: sanitizeString(record.updatedAt) || createdAt,
  };
}

function persistCardPackages() {
  mkdirSync(path.dirname(storageFilePath), { recursive: true });
  writeFileSync(storageFilePath, JSON.stringify(cardPackageStore.packages, null, 2), 'utf-8');
}

function loadCardPackages() {
  if (cardPackageStore.packages.length > 0) {
    return;
  }

  if (!existsSync(storageFilePath)) {
    cardPackageStore.packages = sortCardPackages(defaultCardPackageSeed.map((item, index) => normalizeCardPackage(item, index)));
    persistCardPackages();
    return;
  }

  try {
    const rawContent = readFileSync(storageFilePath, 'utf-8');
    const parsed = JSON.parse(rawContent) as Partial<CardPackage>[];
    if (!Array.isArray(parsed)) {
      throw new Error('次卡套餐数据格式错误');
    }
    cardPackageStore.packages = sortCardPackages(parsed.map((item, index) => normalizeCardPackage(item, index)));
  } catch {
    cardPackageStore.packages = sortCardPackages(defaultCardPackageSeed.map((item, index) => normalizeCardPackage(item, index)));
    persistCardPackages();
  }
}

loadCardPackages();

export function listCardPackages(options: { includeArchived?: boolean } = {}) {
  loadCardPackages();
  const includeArchived = Boolean(options.includeArchived);
  const list = includeArchived
    ? cardPackageStore.packages
    : cardPackageStore.packages.filter((item) => item.status === 'active');
  return clone(sortCardPackages(list));
}

export function getCardPackageById(cardPackageId: string) {
  loadCardPackages();
  const record = cardPackageStore.packages.find((item) => item.id === cardPackageId) ?? null;
  return clone(record);
}

export function createCardPackage(input: Partial<CardPackage>) {
  loadCardPackages();
  const nextRecord = normalizeCardPackage(
    {
      ...input,
      createdAt: now(),
      id: createCardPackageId(),
      updatedAt: now(),
    },
    cardPackageStore.packages.length,
  );
  cardPackageStore.packages = sortCardPackages([nextRecord, ...cardPackageStore.packages]);
  persistCardPackages();
  return clone(nextRecord);
}

export function updateCardPackage(cardPackageId: string, input: Partial<CardPackage>) {
  loadCardPackages();
  const current = cardPackageStore.packages.find((item) => item.id === cardPackageId);
  if (!current) {
    return null;
  }

  const nextRecord = normalizeCardPackage(
    {
      ...current,
      ...input,
      createdAt: current.createdAt,
      id: current.id,
      updatedAt: now(),
    },
    cardPackageStore.packages.findIndex((item) => item.id === cardPackageId),
  );
  cardPackageStore.packages = sortCardPackages(
    cardPackageStore.packages.map((item) => (item.id === cardPackageId ? nextRecord : item)),
  );
  persistCardPackages();
  return clone(nextRecord);
}

export function archiveCardPackage(cardPackageId: string) {
  return updateCardPackage(cardPackageId, { status: 'archived' });
}
