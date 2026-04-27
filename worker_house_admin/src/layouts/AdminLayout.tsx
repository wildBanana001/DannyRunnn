import {
  AppstoreOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  DownOutlined,
  IdcardOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  PictureOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import {
  Avatar,
  Breadcrumb,
  Button,
  Dropdown,
  Layout,
  Menu,
  Space,
  Typography,
  message,
} from 'antd';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useMatches, useNavigate } from 'react-router-dom';
import type { RouteMeta } from '@/router';
import { logout } from '@/services/auth';
import { useAuthStore } from '@/store/authStore';

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const matches = useMatches();
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith('/poster')) {
      return '/poster';
    }

    if (location.pathname.startsWith('/activity')) {
      return '/activity';
    }

    if (location.pathname.startsWith('/registrations')) {
      return '/registrations';
    }

    if (location.pathname.startsWith('/card-orders')) {
      return '/card-orders';
    }

    if (location.pathname.startsWith('/profiles')) {
      return '/profiles';
    }

    if (location.pathname.startsWith('/wall') || location.pathname.startsWith('/treehole')) {
      return '/wall';
    }

    if (location.pathname.startsWith('/site-config')) {
      return '/site-config';
    }

    return '/dashboard';
  }, [location.pathname]);

  const breadcrumbItems = useMemo(
    () =>
      matches.flatMap((match) => {
        const handle = match.handle as RouteMeta | undefined;
        return handle?.breadcrumb ? [{ title: handle.breadcrumb }] : [];
      }),
    [matches],
  );

  const menuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      onClick: () => navigate('/dashboard'),
    },
    {
      key: '/poster',
      icon: <PictureOutlined />,
      label: '海报管理',
      onClick: () => navigate('/poster'),
    },
    {
      key: '/activity',
      icon: <AppstoreOutlined />,
      label: '活动管理',
      onClick: () => navigate('/activity'),
    },
    {
      key: '/registrations',
      icon: <TeamOutlined />,
      label: '报名管理',
      onClick: () => navigate('/registrations'),
    },
    {
      key: '/card-orders',
      icon: <CreditCardOutlined />,
      label: '次卡订单',
      onClick: () => navigate('/card-orders'),
    },
    {
      key: '/profiles',
      icon: <IdcardOutlined />,
      label: '档案库',
      onClick: () => navigate('/profiles'),
    },
    {
      key: '/wall',
      icon: <MessageOutlined />,
      label: '留言墙管理',
      onClick: () => navigate('/wall'),
    },
    {
      key: '/site-config',
      icon: <SettingOutlined />,
      label: '站点配置',
      onClick: () => navigate('/site-config'),
    },
  ];

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore mock logout errors
    }

    clearAuth();
    message.success('已退出登录');
    navigate('/login', { replace: true });
  };

  return (
    <Layout>
      <Layout.Sider className="admin-sider" collapsed={collapsed} trigger={null} width={240}>
        <div className="admin-logo">
          <div className="admin-logo__mark">WH</div>
          {!collapsed ? <span>worker_house 后台</span> : null}
        </div>
        <Menu mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="admin-header">
          <Space size={16} wrap>
            <Button
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              shape="circle"
              type="text"
              onClick={() => setCollapsed((value) => !value)}
            />
            <Breadcrumb items={breadcrumbItems} />
          </Space>

          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                },
              ],
              onClick: handleLogout,
            }}
          >
            <Space className="admin-user-trigger">
              <Avatar style={{ backgroundColor: '#E63946' }}>
                {user?.name?.slice(-1) ?? '管'}
              </Avatar>
              <div>
                <Typography.Text strong>{user?.name ?? '管理员'}</Typography.Text>
                <br />
                <Typography.Text type="secondary">{user?.role ?? 'admin'}</Typography.Text>
              </div>
              <DownOutlined />
            </Space>
          </Dropdown>
        </Layout.Header>
        <Layout.Content className="admin-content">
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

export default AdminLayout;
