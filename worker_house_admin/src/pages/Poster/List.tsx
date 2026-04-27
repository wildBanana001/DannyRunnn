import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, InputNumber, Space, Switch, Table, Typography, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDelete from '@/components/ConfirmDelete';
import PageHeader from '@/components/PageHeader';
import { useTable } from '@/hooks/useTable';
import {
  deletePoster,
  getPosterList,
  updatePoster,
  type PosterListParams,
} from '@/services/poster';
import type { Poster } from '@/types/poster';
import { formatDateTime } from '@/utils/format';

function PosterListPage() {
  const navigate = useNavigate();
  const fetchPosters = useCallback((params: PosterListParams) => getPosterList(params), []);
  const { list, total, loading, query, setQuery, refresh } = useTable<Poster, PosterListParams>(
    fetchPosters,
    {
      page: 1,
      pageSize: 10,
      enabled: undefined,
    },
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deletePoster(id);
      message.success('海报已删除');
      refresh();
    },
    [refresh],
  );

  const handleEnabledChange = useCallback(
    async (record: Poster, enabled: boolean) => {
      await updatePoster(record.id, {
        ...record,
        enabled,
      });
      message.success(enabled ? '海报已启用' : '海报已停用');
      refresh();
    },
    [refresh],
  );

  const handleSortChange = useCallback(
    async (record: Poster, sort: number | null) => {
      const nextSort = Number.isFinite(sort) ? Number(sort) : 0;
      await updatePoster(record.id, {
        ...record,
        sort: nextSort,
      });
      message.success('排序已更新');
      refresh();
    },
    [refresh],
  );

  const columns = useMemo<TableColumnsType<Poster>>(
    () => [
      {
        title: '封面',
        dataIndex: 'coverImage',
        key: 'coverImage',
        width: 100,
        render: (value: string, record) => (
          <div
            style={{
              width: 60,
              height: 80,
              borderRadius: 4,
              overflow: 'hidden',
              backgroundColor: '#f5f5f5',
            }}
          >
            <img
              alt={record.title}
              src={value}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ),
      },
      {
        title: '标题',
        dataIndex: 'title',
        key: 'title',
        render: (value: string) => (
          <Typography.Text ellipsis={{ tooltip: value }}>{value}</Typography.Text>
        ),
      },
      {
        title: '详情图数量',
        key: 'detailImages',
        width: 120,
        render: (_, record) => record.detailImages.length,
      },
      {
        title: '启用状态',
        dataIndex: 'enabled',
        key: 'enabled',
        width: 120,
        render: (value: boolean, record) => (
          <Switch checked={value} onChange={(checked) => handleEnabledChange(record, checked)} />
        ),
      },
      {
        title: '排序值',
        dataIndex: 'sort',
        key: 'sort',
        width: 120,
        render: (value: number, record) => (
          <InputNumber
            min={0}
            size="small"
            value={value}
            onChange={(next) => handleSortChange(record, next)}
          />
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (value: string) => formatDateTime(value),
      },
      {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 180,
        render: (_, record) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              type="link"
              onClick={() => navigate(`/poster/edit/${record.id}`)}
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
    [handleDelete, handleEnabledChange, handleSortChange, navigate],
  );

  return (
    <div className="page-shell">
      <PageHeader
        title="海报管理"
        subtitle="用于维护线下空间展示的海报内容，支持启用切换与排序调整"
        extra={
          <Button icon={<PlusOutlined />} type="primary" onClick={() => navigate('/poster/new')}>
            新增海报
          </Button>
        }
      />

      <Card bordered={false}>
        <div className="page-toolbar">
          <Space>
            <Typography.Text>只看启用</Typography.Text>
            <Switch
              checked={query.enabled === true}
              onChange={(checked) =>
                setQuery({
                  enabled: checked ? true : undefined,
                  page: 1,
                })
              }
            />
          </Space>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          scroll={{ x: 960 }}
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

export default PosterListPage;
