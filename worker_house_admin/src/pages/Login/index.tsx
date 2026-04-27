import {
  DashboardOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { Alert, Button, Card, Form, Input, Space, Tag, Typography, message } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '@/services/auth';
import { useAuthStore } from '@/store/authStore';

const features = [
  {
    icon: <DashboardOutlined />,
    title: '数据与操作集中管理',
    description: '登录后即可统一查看 Dashboard、活动列表和留言墙运营状态。',
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: 'BFF mock 模式开箱即用',
    description: '默认可通过 Node BFF 的 mock 模式直接演示登录、增删改查与置顶操作。',
  },
  {
    icon: <ThunderboltOutlined />,
    title: '可平滑切换真实云函数',
    description: '前端通过环境变量切换到 BFF 地址后，即可联调微信云开发生产数据。',
  },
];

interface LoginFormValues {
  password: string;
  username: string;
}

function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);

    try {
      const result = await login(values);
      setAuth(result);
      message.success('登录成功，欢迎回来');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const errorMessage = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string } | undefined)?.message
        : undefined;
      message.error(errorMessage ?? '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-panel">
        <Tag bordered={false} color="rgba(255,255,255,0.16)">
          worker_house 小程序配套后台
        </Tag>
        <Typography.Title className="login-panel__title" level={1}>
          让运营管理更轻一点，也更稳一点
        </Typography.Title>
        <Typography.Paragraph className="login-panel__subtitle">
          为活动与留言墙场景提供统一后台入口，聚焦内容运营、活动维护与数据概览。
        </Typography.Paragraph>
        <div className="login-feature-grid">
          {features.map((feature) => (
            <div key={feature.title} className="login-feature-card">
              <Space direction="vertical" size={4}>
                <Typography.Text style={{ color: '#fff', fontSize: 18 }}>
                  {feature.icon}
                </Typography.Text>
                <Typography.Text style={{ color: '#fff', fontSize: 16 }} strong>
                  {feature.title}
                </Typography.Text>
                <Typography.Text style={{ color: 'rgba(255,255,255,0.78)' }}>
                  {feature.description}
                </Typography.Text>
              </Space>
            </div>
          ))}
        </div>
      </div>

      <Card className="login-form-card" bordered={false}>
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <Tag color="red">默认演示账号</Tag>
            <Typography.Title level={3} style={{ marginTop: 12, marginBottom: 8 }}>
              登录后台管理系统
            </Typography.Title>
            <Typography.Text type="secondary">
              请输入账号密码进入管理台，默认已填充 BFF mock 模式账号，便于快速联调与验证。
            </Typography.Text>
          </div>

          <Alert
            message="默认账号：admin / admin123"
            description="当前默认指向 BFF mock 模式，可直接登录验证整条联调链路。"
            showIcon
            type="info"
          />

          <Form<LoginFormValues>
            layout="vertical"
            initialValues={{ username: 'admin', password: 'admin123' }}
            onFinish={handleSubmit}
          >
            <Form.Item
              label="账号"
              name="username"
              rules={[{ required: true, message: '请输入账号' }]}
            >
              <Input autoComplete="username" placeholder="请输入账号" size="large" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                autoComplete="current-password"
                placeholder="请输入密码"
                size="large"
              />
            </Form.Item>
            <Button block htmlType="submit" loading={submitting} size="large" type="primary">
              登录并进入 Dashboard
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  );
}

export default LoginPage;
