import Taro from '@tarojs/taro';
import { create } from 'zustand';
import type { User } from '@/types/user';
import { wxGetMe, wxLogin, wxUpdateProfile } from '@/services/auth';

const STORAGE_KEY = 'user';

interface UserState {
  user: User | null;
  isLoggedIn: boolean;
  setUser: (user: User | null) => void;
  bootstrapFromCache: () => void;
  loginWithWx: (profile: { nickname: string; avatar: string }) => Promise<void>;
  refreshWxMe: () => Promise<void>;
  logout: () => void;
}

function persistUser(user: User | null) {
  if (!user) {
    Taro.removeStorageSync(STORAGE_KEY);
    return;
  }

  Taro.setStorageSync(STORAGE_KEY, user);
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isLoggedIn: false,
  setUser: (user) => {
    set({ user, isLoggedIn: !!user });
    persistUser(user);
  },
  bootstrapFromCache: () => {
    try {
      const cached = Taro.getStorageSync<User | null>(STORAGE_KEY);
      if (cached && cached.id) {
        set({ user: cached, isLoggedIn: true });
      }
    } catch (error) {
      console.warn('[userStore] bootstrapFromCache failed', error);
    }
  },
  loginWithWx: async (profile) => {
    if (!profile.nickname || !profile.avatar) {
      Taro.showToast({ title: '请先选择头像并填写昵称', icon: 'none' });
      return;
    }

    try {
      Taro.showLoading({ title: '登录中...' });
      const loginResult = await wxLogin();
      const updated = await wxUpdateProfile(profile);

      const user: User = {
        id: loginResult.openid,
        nickname: updated.nickname || loginResult.nickname || profile.nickname,
        avatar: updated.avatar || profile.avatar,
        openid: loginResult.openid,
        isAdmin: loginResult.isAdmin,
        isLoggedIn: true,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      } as User;

      set({ user, isLoggedIn: true });
      persistUser(user);
      Taro.showToast({ title: '登录成功', icon: 'success' });
    } catch (error) {
      console.warn('[userStore] loginWithWx failed', error);
      Taro.showToast({ title: '登录失败，请稍后重试', icon: 'none' });
    } finally {
      Taro.hideLoading();
    }
  },
  refreshWxMe: async () => {
    try {
      const me = await wxGetMe();
      const current = get().user;

      const user: User = {
        id: me.openid,
        nickname: me.nickname || current?.nickname || '',
        avatar: me.avatar || current?.avatar,
        openid: me.openid,
        isAdmin: current?.isAdmin,
        isLoggedIn: true,
        createdAt: me.createdAt,
        updatedAt: me.updatedAt,
      } as User;

      set({ user, isLoggedIn: true });
      persistUser(user);
    } catch (error) {
      // 404 或其他错误不影响页面展示
      console.warn('[userStore] refreshWxMe failed', error);
    }
  },
  logout: () => {
    try {
      Taro.removeStorageSync(STORAGE_KEY);
    } catch (error) {
      console.warn('[userStore] logout storage failed', error);
    }

    set({ user: null, isLoggedIn: false });
  },
}));
