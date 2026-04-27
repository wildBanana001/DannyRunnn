export const AUTH_STORAGE_KEY = 'worker-house-admin-auth';
export const ADMIN_TOKEN_STORAGE_KEY = 'admin_token';

export function getStorageItem<T>(key: string): T | null {
  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

export function setStorageItem<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorageItem(key: string) {
  window.localStorage.removeItem(key);
}

export function getAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
}

export function setAdminToken(token: string) {
  window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
}

export function removeAdminToken() {
  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
}
