import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  AUTH_STORAGE_KEY,
  removeAdminToken,
  removeStorageItem,
  setAdminToken,
} from '@/utils/storage';

export interface AuthUser {
  id: string;
  name: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (payload: { token: string; user: AuthUser }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: ({ token, user }) => {
        setAdminToken(token);
        set({ token, user });
      },
      clearAuth: () => {
        removeAdminToken();
        removeStorageItem(AUTH_STORAGE_KEY);
        set({ token: null, user: null });
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
