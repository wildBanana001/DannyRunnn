import {
  AppstoreOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  EditOutlined,
  IdcardOutlined,
  MessageOutlined,
  PictureOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router-dom';
import AdminLayout from '@/layouts/AdminLayout';
import AuthLayout from '@/layouts/AuthLayout';
import ActivityEditPage from '@/pages/Activity/Edit';
import ActivityListPage from '@/pages/Activity/List';
import CardOrderListPage from '@/pages/CardOrder/List';
import DashboardPage from '@/pages/Dashboard';
import LoginPage from '@/pages/Login';
import PosterEditPage from '@/pages/Poster/Edit';
import PosterListPage from '@/pages/Poster/List';
import ProfileListPage from '@/pages/Profile/List';
import RegistrationListPage from '@/pages/Registration/List';
import SiteConfigPage from '@/pages/SiteConfig';
import TreeholeListPage from '@/pages/Treehole/List';
import { useAuthStore } from '@/store/authStore';

export interface RouteMeta {
  breadcrumb?: string;
  icon?: ReactNode;
}

function RequireAuth() {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

function RequireGuest() {
  const token = useAuthStore((state) => state.token);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <RequireGuest />,
    children: [
      {
        path: '/login',
        element: <AuthLayout />,
        children: [{ index: true, element: <LoginPage /> }],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          {
            path: 'dashboard',
            element: <DashboardPage />,
            handle: { breadcrumb: 'Dashboard', icon: <DashboardOutlined /> } satisfies RouteMeta,
          },
          {
            path: 'poster',
            handle: { breadcrumb: '海报管理', icon: <PictureOutlined /> } satisfies RouteMeta,
            children: [
              { index: true, element: <PosterListPage /> },
              {
                path: 'new',
                element: <PosterEditPage />,
                handle: { breadcrumb: '新增海报', icon: <EditOutlined /> } satisfies RouteMeta,
              },
              {
                path: 'edit/:id',
                element: <PosterEditPage />,
                handle: { breadcrumb: '编辑海报', icon: <EditOutlined /> } satisfies RouteMeta,
              },
            ],
          },
          {
            path: 'activity',
            handle: { breadcrumb: '活动管理', icon: <AppstoreOutlined /> } satisfies RouteMeta,
            children: [
              { index: true, element: <ActivityListPage /> },
              {
                path: 'new',
                element: <ActivityEditPage />,
                handle: { breadcrumb: '新增活动', icon: <EditOutlined /> } satisfies RouteMeta,
              },
              {
                path: 'edit/:id',
                element: <ActivityEditPage />,
                handle: { breadcrumb: '编辑活动', icon: <EditOutlined /> } satisfies RouteMeta,
              },
            ],
          },
          {
            path: 'registrations',
            element: <RegistrationListPage />,
            handle: { breadcrumb: '报名管理', icon: <TeamOutlined /> } satisfies RouteMeta,
          },
          {
            path: 'card-orders',
            element: <CardOrderListPage />,
            handle: { breadcrumb: '次卡订单', icon: <CreditCardOutlined /> } satisfies RouteMeta,
          },
          {
            path: 'profiles',
            element: <ProfileListPage />,
            handle: { breadcrumb: '档案库', icon: <IdcardOutlined /> } satisfies RouteMeta,
          },
          {
            path: 'wall',
            element: <TreeholeListPage />,
            handle: { breadcrumb: '留言墙管理', icon: <MessageOutlined /> } satisfies RouteMeta,
          },
          {
            path: 'treehole',
            element: <Navigate to="/wall" replace />,
          },
          {
            path: 'site-config',
            element: <SiteConfigPage />,
            handle: { breadcrumb: '站点配置', icon: <SettingOutlined /> } satisfies RouteMeta,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
