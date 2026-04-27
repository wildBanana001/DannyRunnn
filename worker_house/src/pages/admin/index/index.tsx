import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Cell from '@nutui/nutui-react-taro/dist/es/packages/cell/index';
import CellGroup from '@nutui/nutui-react-taro/dist/es/packages/cellgroup/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '@nutui/nutui-react-taro/dist/style.css';
import { checkMiniAdmin, type AdminCheckResult } from '@/services/admin';
import styles from './index.module.scss';

const toastId = 'admin-home-toast';

const defaultResult: AdminCheckResult = {
  isAdmin: false,
  openid: '',
};

const menuItems = [
  {
    title: 'Dashboard',
    description: '查看活动、帖子、报名和次卡订单总览',
    url: '/pages/admin/dashboard/index',
  },
  {
    title: '活动管理',
    description: '查看、创建、编辑和删除活动',
    url: '/pages/admin/activities/index',
  },
  {
    title: '报名管理',
    description: '按活动、状态和关键词查看报名记录并手动改状态',
    url: '/pages/admin/registrations/index',
  },
  {
    title: '次卡订单',
    description: '查看次卡订单、使用记录，并手动调整余量和有效期',
    url: '/pages/admin/card-orders/index',
  },
  {
    title: '次卡套餐',
    description: '维护公开售卖的次卡套餐与展示顺序',
    url: '/pages/admin/card-packages/index',
  },
  {
    title: '留言墙管理',
    description: '管理树洞帖子，支持删除与置顶',
    url: '/pages/admin/posts/index',
  },
  {
    title: '海报管理',
    description: '维护海报内容，支持上架、下架与编辑',
    url: '/pages/admin/posters/index',
  },
  {
    title: '站点配置',
    description: '更新社群二维码、收款微信号与首页文案',
    url: '/pages/admin/site-config/index',
  },
  {
    title: '社畜故事',
    description: '维护首页故事卡片，支持新增、编辑和删除',
    url: '/pages/admin/stories/index',
  },
];

const AdminHomePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AdminCheckResult>(defaultResult);

  const runCheck = async () => {
    setLoading(true);
    try {
      const nextResult = await checkMiniAdmin();
      setResult(nextResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : '管理员校验失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runCheck();
  }, []);

  const handleCopyOpenid = async () => {
    if (!result.openid) {
      Toast.show(toastId, { content: '暂未拿到 openid', icon: 'warn' });
      return;
    }

    await Taro.setClipboardData({ data: result.openid });
    Toast.show(toastId, { content: 'openid 已复制', icon: 'success' });
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.heroCard}>
        <Text className={styles.heroTitle}>管理员中心</Text>
        <Text className={styles.heroDescription}>进入前会自动做 OpenID 白名单鉴权，通过后可直接管理报名、次卡套餐、次卡订单和其他内容模块。</Text>
      </View>

      <View className={styles.statusCard}>
        <Text className={styles.statusLabel}>当前状态</Text>
        <Text className={styles.statusValue}>{loading ? '校验中…' : result.isAdmin ? '已通过管理员校验' : '你不是管理员'}</Text>
        <Text className={styles.openidLabel}>当前 OpenID：{result.openid || '暂未获取到'}</Text>
        <View className={styles.actionRow}>
          <Button type="primary" onClick={handleCopyOpenid}>复制 OpenID</Button>
          <Button onClick={() => void runCheck()}>重新校验</Button>
        </View>
      </View>

      {result.isAdmin ? (
        <View className={styles.menuCard}>
          <CellGroup>
            {menuItems.map((item) => (
              <Cell
                key={item.url}
                clickable
                title={item.title}
                description={item.description}
                extra="进入"
                onClick={() => Taro.navigateTo({ url: item.url })}
              />
            ))}
          </CellGroup>
          <View className={styles.actionRow}>
            <Button type="primary" onClick={() => Taro.navigateTo({ url: '/pages/admin/dashboard/index' })}>先看 Dashboard</Button>
            <Button onClick={() => Taro.switchTab({ url: '/pages/mine/index' })}>退出管理页</Button>
          </View>
        </View>
      ) : (
        <View className={styles.emptyCard}>
          <Text className={styles.emptyTitle}>你不是管理员</Text>
          <Text className={styles.emptyDescription}>把上面的 OpenID 发给部署同学，配置到 ADMIN_OPENID_WHITELIST 后再回来重试。</Text>
        </View>
      )}

      <Toast id={toastId} />
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminHomePage;
