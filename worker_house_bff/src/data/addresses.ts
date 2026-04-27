import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AddressRecord {
  id: string;
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AddressStoreState {
  data: Record<string, AddressRecord[]>;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'addresses.store.json');

const store: AddressStoreState = {
  data: {},
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

function loadAddresses() {
  if (Object.keys(store.data).length > 0) {
    return;
  }

  if (!existsSync(storageFilePath)) {
    store.data = {};
    return;
  }

  try {
    const rawContent = readFileSync(storageFilePath, 'utf-8');
    const parsed = JSON.parse(rawContent) as Record<string, AddressRecord[]>;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('地址数据格式错误');
    }
    
    const nextData: Record<string, AddressRecord[]> = {};
    for (const [openid, arr] of Object.entries(parsed)) {
      if (Array.isArray(arr)) {
        nextData[openid] = arr.map(item => ({
          id: sanitizeString(item.id),
          name: sanitizeString(item.name),
          phone: sanitizeString(item.phone),
          province: sanitizeString(item.province),
          city: sanitizeString(item.city),
          district: sanitizeString(item.district),
          detail: sanitizeString(item.detail),
          isDefault: Boolean(item.isDefault),
          createdAt: sanitizeString(item.createdAt) || now(),
          updatedAt: sanitizeString(item.updatedAt) || now(),
        }));
      }
    }
    store.data = nextData;
  } catch (err) {
    console.error('[addresses store] load error', err);
    store.data = {};
  }
}

function persistAddresses() {
  mkdirSync(path.dirname(storageFilePath), { recursive: true });
  writeFileSync(storageFilePath, JSON.stringify(store.data, null, 2), 'utf-8');
}

export function getAddressesByOpenid(openid: string): AddressRecord[] {
  loadAddresses();
  const normalizedOpenid = sanitizeString(openid);
  if (!normalizedOpenid) return [];
  return clone(store.data[normalizedOpenid] || []);
}

export function createAddress(openid: string, payload: Omit<AddressRecord, 'id' | 'createdAt' | 'updatedAt'>) {
  loadAddresses();
  const normalizedOpenid = sanitizeString(openid);
  if (!normalizedOpenid) throw new Error('openid 不能为空');

  const userAddresses = store.data[normalizedOpenid] || [];
  
  if (payload.isDefault) {
    userAddresses.forEach(a => { a.isDefault = false; });
  }

  const newAddress: AddressRecord = {
    id: `addr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: sanitizeString(payload.name),
    phone: sanitizeString(payload.phone),
    province: sanitizeString(payload.province),
    city: sanitizeString(payload.city),
    district: sanitizeString(payload.district),
    detail: sanitizeString(payload.detail),
    isDefault: payload.isDefault || userAddresses.length === 0, // 第一条默认 true
    createdAt: now(),
    updatedAt: now(),
  };

  userAddresses.push(newAddress);
  store.data[normalizedOpenid] = userAddresses;
  persistAddresses();
  
  return clone(newAddress);
}

export function updateAddress(openid: string, id: string, payload: Partial<Omit<AddressRecord, 'id' | 'createdAt' | 'updatedAt'>>) {
  loadAddresses();
  const normalizedOpenid = sanitizeString(openid);
  if (!normalizedOpenid) throw new Error('openid 不能为空');

  const userAddresses = store.data[normalizedOpenid] || [];
  const index = userAddresses.findIndex(a => a.id === id);
  if (index === -1) {
    throw new Error('地址不存在或无权限');
  }

  if (payload.isDefault) {
    userAddresses.forEach(a => { a.isDefault = false; });
  }

  const current = userAddresses[index];
  const next: AddressRecord = {
    ...current,
    name: payload.name !== undefined ? sanitizeString(payload.name) : current.name,
    phone: payload.phone !== undefined ? sanitizeString(payload.phone) : current.phone,
    province: payload.province !== undefined ? sanitizeString(payload.province) : current.province,
    city: payload.city !== undefined ? sanitizeString(payload.city) : current.city,
    district: payload.district !== undefined ? sanitizeString(payload.district) : current.district,
    detail: payload.detail !== undefined ? sanitizeString(payload.detail) : current.detail,
    isDefault: payload.isDefault !== undefined ? Boolean(payload.isDefault) : current.isDefault,
    updatedAt: now(),
  };

  userAddresses[index] = next;
  store.data[normalizedOpenid] = userAddresses;
  persistAddresses();

  return clone(next);
}

export function deleteAddress(openid: string, id: string) {
  loadAddresses();
  const normalizedOpenid = sanitizeString(openid);
  if (!normalizedOpenid) throw new Error('openid 不能为空');

  const userAddresses = store.data[normalizedOpenid] || [];
  const index = userAddresses.findIndex(a => a.id === id);
  if (index === -1) {
    throw new Error('地址不存在或无权限');
  }

  const isRemovingDefault = userAddresses[index].isDefault;
  userAddresses.splice(index, 1);

  if (isRemovingDefault && userAddresses.length > 0) {
    userAddresses[userAddresses.length - 1].isDefault = true;
  }

  store.data[normalizedOpenid] = userAddresses;
  persistAddresses();
}
