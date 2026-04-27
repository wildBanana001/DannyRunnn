import { DeleteOutlined, PushpinOutlined } from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Input,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import ConfirmDelete from '@/components/ConfirmDelete';
import PageHeader from '@/components/PageHeader';
import { useTable } from '@/hooks/useTable';
import {
  deletePost,
  getPostList,
  updatePostPinned,
  type PostListParams,
} from '@/services/treehole';
import type { Post } from '@/types/post';
import { formatDateTime, getTextExcerpt } from '@/utils/format';

type PostColor = NonNullable<Post['color']>;

const POST_COLOR_OPTIONS: { value: PostColor; label: string; dot: string }[] = [
  { value: 'yellow', label: '黄', dot: '#FACC15' },
  { value: 'pink', label: '粉', dot: '#FB7185' },
  { value: 'blue', label: '蓝', dot: '#3B82F6' },
  { value: 'green', label: '绿', dot: '#22C55E' },
  { value: 'orange', label: '橙', dot: '#FB923C' },
  { value: 'purple', label: '紫', dot: '#A855F7' },
];

function TreeholeListPage() {
  const [keyword, setKeyword] = useState('');
  const [colorFilter, setColorFilter] = useState<PostColor[]>([]);
  const fetchPosts = useCallback((params: PostListParams) => getPostList(params), []);
  const { list, total, loading, query, setQuery, refresh } = useTable<Post, PostListParams>(
    fetchPosts,
    {
      page: 1,
      pageSize: 10,
      keyword: undefined,
      onlyPinned: false,
      colors: undefined,
    },
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deletePost(id);
      message.success('留言已删除');
      refresh();
    },
    [refresh],
  );

  const handlePinToggle = useCallback(
    async (record: Post) => {
      await updatePostPinned(record.id, !record.isPinned);
      message.success(record.isPinned ? '已取消置顶' : '已置顶');
      refresh();
    },
    [refresh],
  );

  const columns = useMemo<TableColumnsType<Post>>(
    () => [
      {
        title: '作者',
        key: 'author',
        width: 180,
        render: (_, record) => (
          <div className="table-user">
            <Avatar src={record.authorAvatar}>{record.authorNickname.slice(0, 1)}</Avatar>
            <div>
              <Typography.Text strong>
                {record.isAnonymous ? '匿名用户' : record.authorNickname}
              </Typography.Text>
              <br />
              <Typography.Text type="secondary">{record.authorId}</Typography.Text>
            </div>
          </div>
        ),
      },
      {
        title: '内容摘要',
        dataIndex: 'content',
        key: 'content',
        render: (value: string) => (
          <span className="table-cell-ellipsis">{getTextExcerpt(value)}</span>
        ),
      },
      {
        title: '图片数',
        key: 'images',
        width: 88,
        render: (_, record) => record.images.length,
      },
      {
        title: '便利贴颜色',
        dataIndex: 'color',
        key: 'color',
        width: 140,
        render: (value: Post['color']) => {
          if (!value) {
            return <Typography.Text type="secondary">默认</Typography.Text>;
          }

          const meta = POST_COLOR_OPTIONS.find((item) => item.value === value);

          if (!meta) {
            return <Typography.Text>{value}</Typography.Text>;
          }

          return (
            <Space>
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: meta.dot,
                }}
              />
              <Typography.Text>{meta.label}</Typography.Text>
            </Space>
          );
        },
      },
      {
        title: '点赞 / 评论',
        key: 'stats',
        width: 120,
        render: (_, record) => `${record.likes} / ${record.comments}`,
      },
      {
        title: '标签',
        key: 'tags',
        render: (_, record) =>
          record.tags.map((tag) => (
            <Tag key={tag} bordered={false} color="default">
              {tag}
            </Tag>
          )),
      },
      {
        title: '是否置顶',
        key: 'isPinned',
        width: 100,
        render: (_, record) =>
          record.isPinned ? (
            <Tag className="sticky-tag">置顶</Tag>
          ) : (
            <Typography.Text type="secondary">否</Typography.Text>
          ),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 160,
        render: (value: string) => formatDateTime(value),
      },
      {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 180,
        render: (_, record) => (
          <Space>
            <Button icon={<PushpinOutlined />} type="link" onClick={() => handlePinToggle(record)}>
              {record.isPinned ? '取消置顶' : '置顶'}
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
    [handleDelete, handlePinToggle],
  );

  return (
    <div className="page-shell">
      <PageHeader title="留言墙管理" subtitle="支持按关键字和颜色筛选留言，删除与置顶等运营操作" />

      <Card bordered={false}>
        <div className="page-toolbar">
          <Space wrap>
            <Input.Search
              allowClear
              enterButton="搜索"
              placeholder="按内容关键字搜索"
              style={{ width: 320 }}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={(value) => setQuery({ keyword: value || undefined, page: 1 })}
            />
            <Space>
              <Typography.Text>只看置顶</Typography.Text>
              <Switch
                checked={query.onlyPinned}
                onChange={(checked) => setQuery({ onlyPinned: checked, page: 1 })}
              />
            </Space>
            <Space>
              <Typography.Text>按颜色筛选</Typography.Text>
              <Select
                allowClear
                mode="multiple"
                placeholder="选择便利贴颜色"
                style={{ width: 220 }}
                value={colorFilter as unknown as string[]}
                options={POST_COLOR_OPTIONS.map((item) => ({
                  label: item.label,
                  value: item.value,
                }))}
                onChange={(next) => {
                  const colors = (next ?? []) as PostColor[];
                  setColorFilter(colors);
                  setQuery({
                    colors: colors.length ? colors.join(',') : undefined,
                    page: 1,
                  });
                }}
              />
            </Space>
          </Space>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          scroll={{ x: 1280 }}
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

export default TreeholeListPage;
