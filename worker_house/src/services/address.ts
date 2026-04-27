import { cloudrunRequest } from './cloudrun';

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

export async function fetchAddresses(): Promise<Address[]> {
  const result = await cloudrunRequest<Address[]>({
    path: '/api/addresses',
    method: 'GET',
  });
  return result ?? [];
}

export async function createAddress(payload: AddressPayload): Promise<Address> {
  const result = await cloudrunRequest<Address>({
    path: '/api/addresses',
    method: 'POST',
    data: payload,
  });
  return result;
}

export async function updateAddress(id: string, payload: Partial<AddressPayload>): Promise<Address> {
  const result = await cloudrunRequest<Address>({
    path: `/api/addresses/${id}`,
    method: 'PUT',
    data: payload,
  });
  return result;
}

export async function deleteAddress(id: string): Promise<void> {
  await cloudrunRequest<void>({
    path: `/api/addresses/${id}`,
    method: 'DELETE',
  });
}
