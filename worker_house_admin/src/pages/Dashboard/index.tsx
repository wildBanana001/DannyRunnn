import {
  AppstoreOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  PictureOutlined,
  RiseOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Space, Spin, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { getActivityList } from '@/services/activity';
import { getPosterList } from '@/services/poster';
import { getPostList } from '@/services/treehole';
import type { Activity } from '@/types/activity';
import type { Post } from '@/types/post';
import type { Poster } from '@/types/poster';
import { ACTIVITY_STATUS_COLOR_MAP, ACTIVITY_STATUS_LABEL_MAP, formatDate } from '@/utils/format';

interface DashboardState {
  activities: Activity[];
  posts: Post[];
  posters: Poster[];
}

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<DashboardState>({
    activities: [],
    posts: [],
    posters: [],
  });

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);

      try {
        const [activityResult, postResult, posterResult] = await Promise.all([
          getActivityList({ page: 1, pageSize: 100 }),
          getPostList({ page: 1, pageSize: 100 }),
          getPosterList({ page: 1, pageSize: 100 }),
        ]);

        setState({
          activities: activityResult.list,
          posts: postResult.list,
          posters: posterResult.list,
        });
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  const stats = useMemo(
    () => [
      {
        title: '活动总数',
        value: state.activities.length,
        helper: '已录入的全部活动数据',
        icon: <AppstoreOutlined style={{ color: '#E63946' }} />,
      },
      {
        title: '进行中活动',
        value: state.activities.filter((item) => item.status === 'ongoing').length,
        helper: '当前处于进行中状态的活动',
        icon: <RiseOutlined style={{ color: '#16A34A' }} />,
      },
      {
        title: '留言墙帖子总数',
        value: state.posts.length,
        helper: '包含匿名与非匿名内容',
        icon: <MessageOutlined style={{ color: '#1D4ED8' }} />,
      },
      {
        title: '置顶帖子数',
        value: state.posts.filter((item) => item.isPinned).length,
        helper: '当前被置顶展示的留言墙内容',
        icon: <StarOutlined style={{ color: '#F59E0B' }} />,
      },
      {
        title: '海报总数',
        value: state.posters.length,
        helper: '已配置的全部海报条目',
        icon: <PictureOutlined style={{ color: '#E63946' }} />,
      },
      {
        title: '启用海报数',
        value: state.posters.filter((item) => item.enabled).length,
        helper: '当前处于启用状态的海报',
        icon: <CheckCircleOutlined style={{ color: '#16A34A' }} />,
      },
    ],
    [state.activities, state.posts, state.posters],
  );

  const recentActivities = useMemo(
    () =>
      [...state.activities]
        .sort(
          (first, second) =>
            new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
        )
        .slice(0, 5),
    [state.activities],
  );

  const columns: TableColumnsType<Activity> = [
    {
      title: '活动标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: Activity['status']) => (
        <Tag color={ACTIVITY_STATUS_COLOR_MAP[status]}>{ACTIVITY_STATUS_LABEL_MAP[status]}</Tag>
      ),
    },
    {
      title: '开始日期',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (value: string) => formatDate(value),
    },
    {
      title: '参与人数',
      key: 'participants',
      render: (_, record) => `${record.currentParticipants}/${record.maxParticipants}`,
    },
  ];

  return (
    <div className="page-shell">
      <PageHeader title="Dashboard" subtitle="快速查看当前活动与留言墙运营概览" />

      <Spin spinning={loading} tip="正在加载概览数据...">
        <Card className="dashboard-hero" bordered={false}>
          <div className="dashboard-hero__content">
            <Typography.Title level={3}>欢迎回到 worker_house 管理台</Typography.Title>
            <Typography.Paragraph>
              这里可以统一处理活动维护、留言墙内容管理以及首页概览统计，适合演示与后续接入真实后端联调。
            </Typography.Paragraph>
          </div>
          <Space direction="vertical" size={8}>
            <Tag color="rgba(255,255,255,0.12)">React 18 + Vite 5</Tag>
            <Tag color="rgba(255,255,255,0.12)">Ant Design 5 + MSW Mock</Tag>
          </Space>
        </Card>

        <Row gutter={[16, 16]}>
          {stats.map((item) => (
            <Col key={item.title} span={24} xl={6} md={12}>
              <Card className="dashboard-stat-card" bordered={false}>
                <Space direction="vertical" size={6}>
                  <Typography.Text type="secondary">{item.title}</Typography.Text>
                  <Typography.Text>{item.icon}</Typography.Text>
                  <div className="dashboard-stat-value">{item.value}</div>
                  <Typography.Text type="secondary">{item.helper}</Typography.Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        <Card bordered={false} title="最近 5 条活动">
          <Table rowKey="id" columns={columns} dataSource={recentActivities} pagination={false} />
        </Card>
      </Spin>
    </div>
  );
}

export default DashboardPage;
