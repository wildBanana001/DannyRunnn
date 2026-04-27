import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Avatar, Button, Card, Input, Select, Space, Table, Tag, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDelete from '@/components/ConfirmDelete';
import PageHeader from '@/components/PageHeader';
import { useTable } from '@/hooks/useTable';
import { deleteActivity, getActivityList, type ActivityListParams } from '@/services/activity';
import type { Activity } from '@/types';
import {
  ACTIVITY_STATUS_COLOR_MAP,
  ACTIVITY_STATUS_LABEL_MAP,
  formatCurrency,
  formatDate,
  getActivityPrimaryCover,
} from '@/utils/format';

function ActivityListPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const fetchActivities = useCallback((params: ActivityListParams) => getActivityList(params), []);
  const { list, total, loading, query, setQuery, refresh } = useTable<Activity, ActivityListParams>(
    fetchActivities,
    {
      page: 1,
      pageSize: 10,
      keyword: undefined,
      status: undefined,
    },
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteActivity(id);
      message.success('活动已删除');
      refresh();
    },
    [refresh],
  );

  const columns = useMemo<TableColumnsType<Activity>>(
    () => [
      {
        title: '封面',
        key: 'coverImage',
        width: 88,
        render: (_, record) => (
          <Avatar shape="square" size={40} src={getActivityPrimaryCover(record)} />
        ),
      },
      {
        title: '标题',
        dataIndex: 'title',
        key: 'title',
      },
      {
        title: '分类',
        dataIndex: 'category',
        key: 'category',
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
        title: '次卡抵扣',
        dataIndex: 'cardEligible',
        key: 'cardEligible',
        render: (value: boolean) => (
          <Tag color={value ? 'success' : 'default'}>{value ? '可用' : '不可用'}</Tag>
        ),
      },
      {
        title: '开始日期',
        dataIndex: 'startDate',
        key: 'startDate',
        render: (value: string) => formatDate(value),
      },
      {
        title: '人数',
        key: 'participants',
        render: (_, record) => `${record.currentParticipants}/${record.maxParticipants}`,
      },
      {
        title: '价格',
        dataIndex: 'price',
        key: 'price',
        render: (value: number) => formatCurrency(value),
      },
      {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 160,
        render: (_, record) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              type="link"
              onClick={() => navigate(`/activity/edit/${record.id}`)}
            >
              编辑
            </Button>
            <ConfirmDelete onConfirm={() => handleDelete(record.id)}>
              <Button danger icon={<DeleteOutlined />} type="link">
                删除
              </Button>
            </ConfirmDelete>
          </Space>
        ),
      },
    ],
    [handleDelete, navigate],
  );

  return (
    <div className="page-shell">
      <PageHeader
        title="活动管理"
        subtitle="支持活动的新增、编辑、删除与基础筛选"
        extra={
          <Button icon={<PlusOutlined />} type="primary" onClick={() => navigate('/activity/new')}>
            新增活动
          </Button>
        }
      />

      <Card bordered={false}>
        <div className="page-toolbar">
          <Space wrap>
            <Input.Search
              allowClear
              enterButton="搜索"
              placeholder="按活动标题搜索"
              style={{ width: 280 }}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={(value) => setQuery({ keyword: value || undefined, page: 1 })}
            />
            <Select<Activity['status'] | undefined>
              allowClear
              placeholder="按状态筛选"
              style={{ width: 180 }}
              value={query.status}
              options={[
                { label: '未开始', value: 'upcoming' },
                { label: '进行中', value: 'ongoing' },
                { label: '已结束', value: 'ended' },
              ]}
              onChange={(value) => setQuery({ status: value, page: 1 })}
            />
          </Space>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          scroll={{ x: 1120 }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total,
            showSizeChanger: true,
            showTotal: (value) => `共 ${value} 条`,
            onChange: (page, pageSize) => setQuery({ page, pageSize }),
          }}
        />
      </Card>
    </div>
  );
}

export default ActivityListPage;
