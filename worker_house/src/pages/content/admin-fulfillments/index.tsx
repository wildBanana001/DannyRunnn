import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import { useViewportLayout } from '@/hooks/useViewportLayout';
import {
  completeAdminFulfillmentTask,
  fetchAdminFulfillmentTasks,
  fetchAdminIdentity,
  type AdminFulfillmentTask,
} from '@/services/adminFulfillment';
import { formatPrice } from '@/utils/helpers';
import styles from './index.module.scss';

type PageState = 'loading' | 'ready' | 'forbidden' | 'error';

function formatTimestamp(value: string) {
  if (!value) return '时间待确认';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

const AdminFulfillmentsPage: React.FC = () => {
  const [tasks, setTasks] = useState<AdminFulfillmentTask[]>([]);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [processingKey, setProcessingKey] = useState('');
  const [pendingTask, setPendingTask] = useState<AdminFulfillmentTask | null>(null);
  const viewportStyle = useViewportLayout();

  const loadTasks = useCallback(async () => {
    setPageState('loading');
    setErrorMessage('');
    try {
      const identity = await fetchAdminIdentity();
      if (!identity.isAdmin) {
        setTasks([]);
        setPageState('forbidden');
        return;
      }
      const nextTasks = await fetchAdminFulfillmentTasks();
      setTasks(nextTasks);
      setPageState('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : '待核销订单加载失败';
      if (message.includes('不是管理员') || message.includes('401')) {
        setPageState('forbidden');
        return;
      }
      setErrorMessage(message);
      setPageState('error');
    }
  }, []);

  useDidShow(() => {
    void loadTasks();
  });

  const handleComplete = async () => {
    const task = pendingTask;
    if (!task) return;

    const taskKey = `${task.kind}:${task.id}`;
    if (processingKey) return;

    const isRetry = task.action === 'retry';
    setPendingTask(null);
    setProcessingKey(taskKey);
    try {
      await completeAdminFulfillmentTask(task);
      setTasks((current) => current.filter((item) => `${item.kind}:${item.id}` !== taskKey));
      Taro.showToast({ title: isRetry ? '微信同步成功' : '核销成功', icon: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '核销失败，请稍后重试';
      Taro.showToast({ title: message, icon: 'none', duration: 3000 });
      await loadTasks();
    } finally {
      setProcessingKey('');
    }
  };

  if (pageState === 'loading') {
    return (
      <View className={styles.statePage} style={viewportStyle}>
        <Text className={styles.stateText}>正在读取待核销订单...</Text>
      </View>
    );
  }

  if (pageState === 'forbidden') {
    return (
      <View className={styles.statePage} style={viewportStyle}>
        <EmptyState title="仅管理员可访问" description="当前微信账号不在管理员 OpenID 白名单中。" />
      </View>
    );
  }

  if (pageState === 'error') {
    return (
      <View className={styles.statePage} style={viewportStyle}>
        <EmptyState title="待核销订单加载失败" description={errorMessage}>
          <Button type="outline" onClick={() => void loadTasks()}>重新加载</Button>
        </EmptyState>
      </View>
    );
  }

  return (
    <View className={styles.page} style={viewportStyle}>
      <ScrollView className={styles.container} scrollY enableFlex>
        <View className={styles.header}>
          <Text className={styles.eyebrow}>PRIVATE OPERATIONS</Text>
          <Text className={styles.title}>到店核销台</Text>
          <Text className={styles.description}>
            只显示已付款待交付订单，以及交付完成但微信同步失败的订单。确认核销后，服务端会自动上报“用户自提”。
          </Text>
          <View className={styles.summaryRow}>
            <View className={styles.summaryText}>
              <Text className={styles.summaryValue}>{tasks.length}</Text>
              <Text className={styles.summaryLabel}>笔待处理</Text>
            </View>
            <Button type="outline" size="small" onClick={() => void loadTasks()}>刷新</Button>
          </View>
        </View>

        {tasks.length === 0 ? (
          <View className={styles.emptyWrap}>
            <EmptyState title="当前没有待核销订单" description="新订单支付成功后，会在实际到店交付或活动开始时出现在这里。" />
          </View>
        ) : (
          <View className={styles.taskList}>
            {tasks.map((task) => {
              const taskKey = `${task.kind}:${task.id}`;
              const isRetry = task.action === 'retry';
              return (
                <View key={taskKey} className={styles.taskCard}>
                  <View className={styles.cardHeading}>
                    <View className={`${styles.kindBadge} ${isRetry ? styles.retryBadge : ''}`}>
                      <Text>{isRetry ? '同步失败' : task.kind === 'activity' ? '活动' : '商品'}</Text>
                    </View>
                    <Text className={styles.paidAt}>支付于 {formatTimestamp(task.paidAt || task.createdAt)}</Text>
                  </View>

                  <Text className={styles.taskTitle}>{task.title}</Text>
                  <Text className={styles.participantName}>{task.participantName}</Text>
                  {task.participantContact ? <Text className={styles.metaText}>{task.participantContact}</Text> : null}

                  <View className={styles.detailGrid}>
                    <View className={styles.detailItem}>
                      <Text className={styles.detailLabel}>交付方式</Text>
                      <Text className={styles.detailValue}>{task.fulfillmentLabel}</Text>
                    </View>
                    <View className={styles.detailItem}>
                      <Text className={styles.detailLabel}>实付</Text>
                      <Text className={styles.detailValue}>{formatPrice(task.amount / 100)}</Text>
                    </View>
                    <View className={styles.detailItem}>
                      <Text className={styles.detailLabel}>数量</Text>
                      <Text className={styles.detailValue}>{task.quantity} {task.unitLabel}</Text>
                    </View>
                  </View>

                  {task.remark ? <Text className={styles.remark}>备注：{task.remark}</Text> : null}
                  {isRetry ? (
                    <View className={styles.errorBox}>
                      <Text className={styles.errorTitle}>微信上报失败 · 已尝试 {task.wechatShippingAttempts} 次</Text>
                      <Text className={styles.errorText}>{task.wechatShippingError || '请重新同步微信订单。'}</Text>
                    </View>
                  ) : null}

                  <Text className={styles.orderId}>订单号 {task.id}</Text>
                  <Button
                    block
                    type={isRetry ? 'secondary' : 'primary'}
                    loading={processingKey === taskKey}
                    disabled={Boolean(processingKey) && processingKey !== taskKey}
                    onClick={() => setPendingTask(task)}
                  >
                    {isRetry ? '重试同步微信' : task.kind === 'activity' ? '确认到场并核销' : '确认交付并上报'}
                  </Button>
                </View>
              );
            })}
          </View>
        )}

        <View className={styles.bottomSpacing} />
      </ScrollView>

      {pendingTask ? (
        <View className={styles.confirmOverlay} catchMove onClick={() => setPendingTask(null)}>
          <View className={styles.confirmModal} onClick={(event) => event.stopPropagation()}>
            <Text className={styles.confirmTitle}>
              {pendingTask.action === 'retry'
                ? '重试同步微信'
                : pendingTask.kind === 'activity'
                  ? '确认用户已到场'
                  : '确认商品已交付'}
            </Text>
            <Text className={styles.confirmText}>
              {pendingTask.action === 'retry'
                ? '将重新向微信上报这笔订单的用户自提信息。'
                : `请确认“${pendingTask.title}”已经实际${pendingTask.kind === 'activity' ? '开始提供活动服务' : '交付给用户'}，确认后将同步微信订单。`}
            </Text>
            <View className={styles.confirmActions}>
              <Button type="outline" block onClick={() => setPendingTask(null)}>再检查一下</Button>
              <Button type="primary" block onClick={() => void handleComplete()}>
                {pendingTask.action === 'retry' ? '立即重试' : '确认核销'}
              </Button>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default AdminFulfillmentsPage;
