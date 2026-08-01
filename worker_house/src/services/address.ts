import Taro from '@tarojs/taro';
import { getApiMode, request } from './request';

export interface Address {
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

export interface AddressPayload {
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault?: boolean;
}

const MOCK_STORAGE_KEY = 'worker-house-mock-addresses-v1';

function normalizeMockAddresses(addresses: Address[]): Address[] {
  if (addresses.length === 0) {
    return [];
  }

  const defaultAddress = addresses.find((item) => item.isDefault) ?? addresses[0];
  return addresses.map((item) => ({
    ...item,
    isDefault: item.id === defaultAddress.id,
  }));
}

function getMockAddresses(): Address[] {
  const cached = Taro.getStorageSync<Address[] | null>(MOCK_STORAGE_KEY);
  return Array.isArray(cached) ? normalizeMockAddresses(cached) : [];
}

function saveMockAddresses(addresses: Address[]): Address[] {
  const normalized = normalizeMockAddresses(addresses);
  Taro.setStorageSync(MOCK_STORAGE_KEY, normalized);
  return normalized;
}

export async function fetchAddresses(): Promise<Address[]> {
  if (getApiMode() === 'mock') {
    return getMockAddresses();
  }

  const result = await request<Address[]>({
    path: '/api/addresses',
    method: 'GET',
  });
  return result ?? [];
}

export async function createAddress(payload: AddressPayload): Promise<Address> {
  if (getApiMode() === 'mock') {
    const addresses = getMockAddresses();
    const timestamp = new Date().toISOString();
    const address: Address = {
      ...payload,
      id: `address-${Date.now()}`,
      isDefault: Boolean(payload.isDefault || addresses.length === 0),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    saveMockAddresses([
      address,
      ...addresses.map((item) => ({
        ...item,
        isDefault: address.isDefault ? false : item.isDefault,
      })),
    ]);
    return address;
  }

  const result = await request<Address>({
    path: '/api/addresses',
    method: 'POST',
    data: payload,
  });
  return result;
}

export async function updateAddress(id: string, payload: Partial<AddressPayload>): Promise<Address> {
  if (getApiMode() === 'mock') {
    const addresses = getMockAddresses();
    const current = addresses.find((item) => item.id === id);
    if (!current) {
      throw new Error('地址不存在');
    }
    const next: Address = {
      ...current,
      ...payload,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };
    saveMockAddresses(addresses.map((item) => {
      if (item.id === id) {
        return next;
      }
      return payload.isDefault ? { ...item, isDefault: false } : item;
    }));
    return next;
  }

  const result = await request<Address>({
    path: `/api/addresses/${encodeURIComponent(id)}`,
    method: 'PUT',
    data: payload,
  });
  return result;
}

export async function deleteAddress(id: string): Promise<void> {
  if (getApiMode() === 'mock') {
    saveMockAddresses(getMockAddresses().filter((item) => item.id !== id));
    return;
  }

  await request<void>({
    path: `/api/addresses/${encodeURIComponent(id)}`,
    method: 'DELETE',
  });
}
