import { EyeOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Divider, Drawer, Select, Space, Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { useTable } from '@/hooks/useTable';
import { getActivityList } from '@/services/activity';
import { getRegistrationList, type RegistrationListParams } from '@/services/registration';
import type { Activity, Registration } from '@/types';
import {
  PROFILE_GENDER_LABEL_MAP,
  REGISTRATION_STATUS_COLOR_MAP,
  REGISTRATION_STATUS_LABEL_MAP,
  formatCurrency,
  formatDateTime,
} from '@/utils/format';

function RegistrationListPage() {
  const [activeRegistration, setActiveRegistration] = useState<Registration | null>(null);
  const [activityOptions, setActivityOptions] = useState<{ label: string; value: string }[]>([]);
  const fetchRegistrations = useCallback(
    (params: RegistrationListParams) => getRegistrationList(params),
    [],
  );
  const { list, total, loading, query, setQuery } = useTable<Registration, RegistrationListParams>(
    fetchRegistrations,
    {
      activityId: undefined,
      page: 1,
      pageSize: 10,
      status: undefined,
    },
  );

  useEffect(() => {
    const loadActivities = async () => {
      const result = await getActivityList({
        page: 1,
        pageSize: 100,
        status: undefined,
        keyword: undefined,
      });
      setActivityOptions(
        result.list.map((activity: Activity) => ({
          label: activity.title,
          value: activity.id,
        })),
      );
    };

    void loadActivities();
  }, []);

  const columns = useMemo<TableColumnsType<Registration>>(
    () => [
      {
        title: '活动',
        dataIndex: 'activityTitle',
        key: 'activityTitle',
        width: 220,
      },
      {
        title: '报名人昵称',
        dataIndex: 'participantNickname',
        key: 'participantNickname',
        width: 120,
      },
      {
        title: '微信名',
        dataIndex: 'wechatName',
        key: 'wechatName',
        width: 140,
      },
      {
        title: '手机',
        dataIndex: 'phone',
        key: 'phone',
        width: 140,
        render: (value?: string) => value || '--',
      },
      {
        title: '是否用次卡',
        dataIndex: 'useCard',
        key: 'useCard',
        width: 120,
        render: (value: boolean) => (
          <Tag color={value ? 'success' : 'default'}>{value ? '是' : '否'}</Tag>
        ),
      },
      {
        title: '原价',
        dataIndex: 'originalPrice',
        key: 'originalPrice',
        width: 110,
        render: (value: number) => formatCurrency(value),
      },
      {
        title: '抵扣',
        dataIndex: 'deductionAmount',
        key: 'deductionAmount',
        width: 110,
        render: (value: number) => formatCurrency(value),
      },
      {
        title: '实付',
        dataIndex: 'amountPaid',
        key: 'amountPaid',
        width: 110,
        render: (value: number) => formatCurrency(value),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (value: Registration['status']) => (
          <Tag color={REGISTRATION_STATUS_COLOR_MAP[value]}>
            {REGISTRATION_STATUS_LABEL_MAP[value]}
          </Tag>
        ),
      },
      {
        title: '报名时间',
        dataIndex: 'registeredAt',
        key: 'registeredAt',
        width: 180,
        render: (value: string) => formatDateTime(value),
      },
      {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 100,
        render: (_, record) => (
          <Button icon={<EyeOutlined />} type="link" onClick={() => setActiveRegistration(record)}>
            详情
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="page-shell">
      <PageHeader
        title="报名管理"
        subtitle="查看活动报名、次卡抵扣与档案快照，支持按活动与状态快速筛选"
      />

      <Card bordered={false}>
        <div className="page-toolbar">
          <Space wrap>
            <Select
              allowClear
              placeholder="按活动筛选"
              style={{ width: 320 }}
              value={query.activityId}
              options={activityOptions}
              onChange={(value) => setQuery({ activityId: value, page: 1 })}
            />
            <Select<Registration['status'] | undefined>
              allowClear
              placeholder="按状态筛选"
              style={{ width: 180 }}
              value={query.status}
              options={[
                { label: '待确认', value: 'pending' },
                { label: '已确认', value: 'confirmed' },
                { label: '已取消', value: 'cancelled' },
                { label: '已完成', value: 'completed' },
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
          scroll={{ x: 1440 }}
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

      <Drawer
        width={640}
        title="报名详情"
        open={Boolean(activeRegistration)}
        onClose={() => setActiveRegistration(null)}
        destroyOnClose
      >
        {activeRegistration ? (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="活动">{activeRegistration.activityTitle}</Descriptions.Item>
              <Descriptions.Item label="报名状态">
                <Tag color={REGISTRATION_STATUS_COLOR_MAP[activeRegistration.status]}>
                  {REGISTRATION_STATUS_LABEL_MAP[activeRegistration.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="报名人昵称">
                {activeRegistration.participantNickname}
              </Descriptions.Item>
              <Descriptions.Item label="微信名">{activeRegistration.wechatName}</Descriptions.Item>
              <Descriptions.Item label="手机">{activeRegistration.phone || '--'}</Descriptions.Item>
              <Descriptions.Item label="是否使用次卡">
                <Tag color={activeRegistration.useCard ? 'success' : 'default'}>
                  {activeRegistration.useCard ? '是' : '否'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="原价">
                {formatCurrency(activeRegistration.originalPrice)}
              </Descriptions.Item>
              <Descriptions.Item label="抵扣">
                {formatCurrency(activeRegistration.deductionAmount)}
              </Descriptions.Item>
              <Descriptions.Item label="实付">
                {formatCurrency(activeRegistration.amountPaid)}
              </Descriptions.Item>
              <Descriptions.Item label="报名时间">
                {formatDateTime(activeRegistration.registeredAt)}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">档案快照（8 个字段）</Divider>

            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="昵称">
                {activeRegistration.profileSnapshot.nickname}
              </Descriptions.Item>
              <Descriptions.Item label="性别">
                {PROFILE_GENDER_LABEL_MAP[activeRegistration.profileSnapshot.gender]}
              </Descriptions.Item>
              <Descriptions.Item label="年龄段">
                {activeRegistration.profileSnapshot.ageRange}
              </Descriptions.Item>
              <Descriptions.Item label="行业">
                {activeRegistration.profileSnapshot.industry}
              </Descriptions.Item>
              <Descriptions.Item label="职业 / 岗位">
                {activeRegistration.profileSnapshot.occupation}
              </Descriptions.Item>
              <Descriptions.Item label="所在城市">
                {activeRegistration.profileSnapshot.city}
              </Descriptions.Item>
              <Descriptions.Item label="社交诉求">
                {activeRegistration.profileSnapshot.socialGoal}
              </Descriptions.Item>
              <Descriptions.Item label="自我介绍">
                {activeRegistration.profileSnapshot.introduction}
              </Descriptions.Item>
            </Descriptions>
          </>
        ) : null}
      </Drawer>
    </div>
  );
}

export default RegistrationListPage;
