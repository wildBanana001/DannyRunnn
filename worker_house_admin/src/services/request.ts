import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { getAdminToken } from '@/utils/storage';

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 10000,
});

request.interceptors.request.use((config) => {
  const token = getAdminToken() ?? useAuthStore.getState().token;

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

request.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();

      if (window.location.pathname !== '/login') {
        const redirectPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.sessionStorage.setItem('worker_house_admin_redirect', redirectPath);
        window.location.replace('/login');
      }
    }

    return Promise.reject(error);
  },
);

export default request;
