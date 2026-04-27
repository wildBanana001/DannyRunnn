import { Card, Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import { useTable } from '@/hooks/useTable';
import { getProfileList, type ProfileListParams } from '@/services/profile';
import type { Profile } from '@/types';
import { PROFILE_GENDER_LABEL_MAP, formatDateTime } from '@/utils/format';

function ProfileListPage() {
  const fetchProfiles = useCallback((params: ProfileListParams) => getProfileList(params), []);
  const { list, total, loading, query, setQuery } = useTable<Profile, ProfileListParams>(
    fetchProfiles,
    {
      page: 1,
      pageSize: 10,
    },
  );

  const columns = useMemo<TableColumnsType<Profile>>(
    () => [
      {
        title: '昵称',
        dataIndex: 'nickname',
        key: 'nickname',
      },
      {
        title: '性别',
        dataIndex: 'gender',
        key: 'gender',
        render: (value: Profile['gender']) => PROFILE_GENDER_LABEL_MAP[value],
      },
      {
        title: '行业',
        dataIndex: 'industry',
        key: 'industry',
      },
      {
        title: '标签',
        dataIndex: 'tags',
        key: 'tags',
        render: (tags: string[]) => tags.map((tag) => <Tag key={tag}>{tag}</Tag>),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value: string) => formatDateTime(value),
      },
    ],
    [],
  );

  return (
    <div className="page-shell">
      <PageHeader
        title="档案库"
        subtitle="当前提供轻量档案列表，便于运营侧快速查看用户基础画像。"
      />

      <Card bordered={false}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
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

export default ProfileListPage;
