import React, { useCallback, useRef, useState } from 'react';
import { Input, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import SafeImage from '@/components/SafeImage';
import { useViewportLayout } from '@/hooks/useViewportLayout';
import { fetchAdminIdentity } from '@/services/adminFulfillment';
import { fetchAdminActivities, saveAdminActivity, type AdminActivity } from '@/services/adminActivity';
import { formatPrice } from '@/utils/helpers';
import styles from './index.module.scss';

export default function AdminActivitiesPage(): React.ReactElement {
  const viewportStyle = useViewportLayout();
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading');
  const [items, setItems] = useState<AdminActivity[]>([]);
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (nextPage = 1, nextQuery = '') => {
    const id = ++requestId.current;
    if (nextPage === 1) setState('loading');
    setBusy(true);
    setError('');
    try {
      const identity = await fetchAdminIdentity();
      if (id !== requestId.current) return;
      if (!identity.isAdmin) { setItems([]); setState('forbidden'); return; }
      const result = await fetchAdminActivities(nextPage, nextQuery);
      if (id !== requestId.current) return;
      setItems((current) => nextPage === 1 ? result.list : [...current, ...result.list]);
      setTotal(result.total); setPage(nextPage); setQuery(nextQuery); setState('ready');
    } catch (cause) {
      if (id !== requestId.current) return;
      setError(cause instanceof Error ? cause.message : '活动加载失败');
      if (nextPage === 1) setState('error');
    } finally { if (id === requestId.current) setBusy(false); }
  }, []);

  useDidShow(() => { void load(1, query); });

  const edit = (id?: string) => Taro.navigateTo({
    url: `/pages/content/admin-activity-edit/index${id ? `?id=${encodeURIComponent(id)}` : ''}`,
  });

  const unpublish = async (item: AdminActivity) => {
    if (busy) return;
    const answer = await Taro.showModal({ title: '下架活动', content: `下架「${item.title}」后将停止新报名，已有订单和报名记录保留。`, confirmText: '确认下架' });
    if (!answer.confirm) return;
    setBusy(true);
    try {
      await saveAdminActivity(item.id, { enabled: false });
      Taro.showToast({ title: '活动已下架', icon: 'success' });
      await load(1, query);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '下架失败'); }
    finally { setBusy(false); }
  };

  if (state === 'forbidden') return <View className={styles.state} style={viewportStyle}><EmptyState title="仅管理员可访问" description="请使用已加入管理员白名单的微信账号。" /></View>;
  if (state === 'error') return <View className={styles.state} style={viewportStyle}><EmptyState title="管理后台暂不可用" description={error}><Button block onClick={() => void load(1, query)}>重试</Button></EmptyState></View>;

  return (
    <ScrollView scrollY className={styles.page} style={viewportStyle}>
      <View className={styles.header}>
        <Text className={styles.eyebrow}>WORKER HOUSE / ADMIN</Text>
        <Text className={styles.heading}>管理后台</Text>
        <Text className={styles.subtitle}>把好活动带到大家面前。</Text>
      </View>
      <View className={styles.createCard}>
        <Text className={styles.cardTitle}>下一场活动，从一篇推文开始</Text>
        <Text className={styles.muted}>粘贴复制出来的推文正文，生成草稿后编辑发布。</Text>
        <Button block onClick={() => void edit()}>＋ 创建活动</Button>
      </View>
      <View className={styles.fulfillment} onClick={() => Taro.navigateTo({ url: '/pages/content/admin-fulfillments/index' })}>
        <View><Text className={styles.linkTitle}>订单核销</Text><Text className={styles.muted}>活动到场 · 商品交付 · 微信同步</Text></View>
        <Text className={styles.arrow}>→</Text>
      </View>
      <View className={styles.sectionHeading}><Text className={styles.cardTitle}>活动管理</Text><Text className={styles.muted}>{total} 场活动</Text></View>
      <View className={styles.search}>
        <Input className={styles.searchInput} value={keyword} maxlength={100} placeholder="搜索活动标题" onInput={(event) => setKeyword(event.detail.value)} onConfirm={() => void load(1, keyword.trim())} />
        <Button className={styles.compactButton} size="small" type="outline" disabled={busy} onClick={() => void load(1, keyword.trim())}>搜索</Button>
      </View>
      {error ? <Text className={styles.error}>{error}</Text> : null}
      {state === 'loading' ? <Text className={styles.loading}>正在读取活动…</Text> : null}
      {state === 'ready' && items.length === 0 ? <EmptyState title={query ? '没有匹配的活动' : '准备好下一场相聚了吗'} description={query ? '换个关键词试试。' : '点击上方「创建活动」，从推文导入或手动填写。'} /> : null}
      {state === 'ready' ? items.map((item) => (
        <View className={styles.activity} key={item.id}>
          <View className={styles.activityTop}>
            <SafeImage className={styles.cover} src={item.coverImage} mode="aspectFill" fallbackDelayMs={2500} />
            <View className={styles.activityInfo}>
              <Text className={item.enabled ? styles.liveBadge : styles.draftBadge}>{item.enabled ? item.status === 'ended' ? '已结束' : '已上架' : '未发布 / 已下架'}</Text>
              <Text className={styles.activityTitle}>{item.title}</Text>
              <Text className={styles.muted}>{item.startDate} {item.startTime}</Text>
              <Text className={styles.muted}>{formatPrice(item.price)} / 人 · 名额 {item.maxParticipants} 人</Text>
            </View>
          </View>
          <View className={styles.actions}>
            <Button size="small" type="outline" disabled={busy} onClick={() => void edit(item.id)}>{item.enabled ? '编辑活动' : '编辑 / 发布'}</Button>
            {item.enabled ? <Button size="small" type="ghost" disabled={busy} onClick={() => void unpublish(item)}>下架</Button> : null}
          </View>
        </View>
      )) : null}
      {state === 'ready' && items.length < total ? <Button block type="outline" loading={busy} onClick={() => void load(page + 1, query)}>加载更多</Button> : null}
      <Text className={styles.footer}>仅管理员可见 · 发布后同步到小程序活动列表</Text>
    </ScrollView>
  );
}
