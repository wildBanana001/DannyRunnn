import { Card, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import { useTable } from '@/hooks/useTable';
import { getCardOrderList, type CardOrderListParams } from '@/services/cardOrder';
import type { CardOrder, CardUsageLog } from '@/types';
import {
  CARD_ORDER_STATUS_COLOR_MAP,
  CARD_ORDER_STATUS_LABEL_MAP,
  CARD_USAGE_STATUS_COLOR_MAP,
  CARD_USAGE_STATUS_LABEL_MAP,
  formatCurrency,
  formatDateTime,
} from '@/utils/format';

function CardOrderListPage() {
  const fetchCardOrders = useCallback(
    (params: CardOrderListParams) => getCardOrderList(params),
    [],
  );
  const { list, total, loading, query, setQuery } = useTable<CardOrder, CardOrderListParams>(
    fetchCardOrders,
    {
      page: 1,
      pageSize: 10,
    },
  );

  const usageColumns = useMemo<TableColumnsType<CardUsageLog>>(
    () => [
      {
        title: '活动',
        dataIndex: 'activityTitle',
        key: 'activityTitle',
      },
      {
        title: '抵扣次数',
        dataIndex: 'deductionCount',
        key: 'deductionCount',
        width: 100,
        render: (value: number) => `${value} 次`,
      },
      {
        title: '抵扣金额',
        dataIndex: 'deductionAmount',
        key: 'deductionAmount',
        width: 120,
        render: (value: number) => formatCurrency(value),
      },
      {
        title: '记录时间',
        dataIndex: 'usedAt',
        key: 'usedAt',
        width: 180,
        render: (value: string) => formatDateTime(value),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (value: CardUsageLog['status']) => (
          <Tag color={CARD_USAGE_STATUS_COLOR_MAP[value]}>{CARD_USAGE_STATUS_LABEL_MAP[value]}</Tag>
        ),
      },
      {
        title: '操作人',
        dataIndex: 'operatorName',
        key: 'operatorName',
        width: 120,
      },
      {
        title: '备注',
        dataIndex: 'note',
        key: 'note',
        render: (value?: string) => value || '--',
      },
    ],
    [],
  );

  const columns = useMemo<TableColumnsType<CardOrder>>(
    () => [
      {
        title: '用户',
        key: 'userNickname',
        width: 180,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{record.userNickname}</Typography.Text>
            <Typography.Text type="secondary">{record.userWechatName}</Typography.Text>
          </Space>
        ),
      },
      {
        title: '卡类型',
        dataIndex: 'cardType',
        key: 'cardType',
        width: 220,
      },
      {
        title: '总次',
        dataIndex: 'totalCount',
        key: 'totalCount',
        width: 90,
        render: (value: number) => `${value} 次`,
      },
      {
        title: '已用',
        dataIndex: 'usedCount',
        key: 'usedCount',
        width: 90,
        render: (value: number) => `${value} 次`,
      },
      {
        title: '剩余',
        dataIndex: 'remainingCount',
        key: 'remainingCount',
        width: 90,
        render: (value: number) => `${value} 次`,
      },
      {
        title: '金额',
        dataIndex: 'amount',
        key: 'amount',
        width: 120,
        render: (value: number) => formatCurrency(value),
      },
      {
        title: '购买时间',
        dataIndex: 'purchasedAt',
        key: 'purchasedAt',
        width: 180,
        render: (value: string) => formatDateTime(value),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (value: CardOrder['status']) => (
          <Tag color={CARD_ORDER_STATUS_COLOR_MAP[value]}>{CARD_ORDER_STATUS_LABEL_MAP[value]}</Tag>
        ),
      },
    ],
    [],
  );

  return (
    <div className="page-shell">
      <PageHeader
        title="次卡订单"
        subtitle="查看社畜次卡购买与使用情况，展开行可追踪具体抵扣记录"
      />

      <Card bordered={false}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          scroll={{ x: 1160 }}
          expandable={{
            expandedRowRender: (record) => (
              <Table<CardUsageLog>
                rowKey="id"
                columns={usageColumns}
                dataSource={record.usageLogs}
                pagination={false}
                size="small"
              />
            ),
            rowExpandable: (record) => record.usageLogs.length > 0,
          }}
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

export default CardOrderListPage;
