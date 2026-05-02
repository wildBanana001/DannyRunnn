import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Button } from '@tarojs/components';
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro';
import { OFFICIAL_ACCOUNT_ID, OFFICIAL_ACCOUNT_NAME } from '@/constants/official-account';
import styles from './index.module.scss';

const OfficialAccount: any = 'official-account';

const StoryWebViewPage: React.FC = () => {
  const router = useRouter();
  const mode = router.params.mode || '';
  const isOfficialHomeMode = mode === 'official-home';
  const rawUrl = router.params.url ? decodeURIComponent(router.params.url) : '';
  const rawTitle = router.params.title ? decodeURIComponent(router.params.title) : '';
  const rawCover = router.params.cover ? decodeURIComponent(router.params.cover) : '';
  const rawAuthor = router.params.author ? decodeURIComponent(router.params.author) : '';
  const rawDate = router.params.date ? decodeURIComponent(router.params.date) : '';
  const rawExcerpt = router.params.excerpt ? decodeURIComponent(router.params.excerpt) : '';
  const title = isOfficialHomeMode ? '公众号主页' : rawTitle || '公众号文章';
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: title.length > 16 ? '公众号文章' : title });
  }, [title]);

  useShareAppMessage(() => ({
    title: isOfficialHomeMode ? '扫码关注后可查看全部文章' : title || '一篇来自社畜快乐屋的文章',
    path: isOfficialHomeMode
      ? '/pages/content/story-webview/index?mode=official-home'
      : `/pages/content/story-webview/index?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(title)}&cover=${encodeURIComponent(rawCover)}`,
    imageUrl: rawCover || undefined
  }));

  const metaLine = useMemo(() => {
    const parts: string[] = [];
    if (rawAuthor) {
      parts.push(rawAuthor);
    }
    if (rawDate) {
      parts.push(rawDate);
    }
    return parts.join(' · ');
  }, [rawAuthor, rawDate]);

  const copyText = async (data: string, successText: string) => {
    if (!data || copying) {
      return;
    }

    setCopying(true);
    try {
      await Taro.setClipboardData({ data });
      Taro.showToast({ title: successText, icon: 'none', duration: 2200 });
    } catch {
      Taro.showToast({ title: '复制失败，请重试', icon: 'none' });
    } finally {
      setTimeout(() => setCopying(false), 800);
    }
  };

  const handleBack = () => {
    Taro.navigateBack({ delta: 1 });
  };

  const handleShare = () => {
    Taro.showToast({
      title: '请点击右上角 ···，选择“转发给朋友”',
      icon: 'none',
      duration: 2400
    });
  };

  if (isOfficialHomeMode) {
    return (
      <View className={styles.page}>
        <View className={styles.header}>
          <Text className={styles.tag}>公众号主页</Text>
          <Text className={styles.title}>更多有趣，都在公众号里</Text>
          <Text className={styles.lead}>扫码关注后可查看全部文章，也可以先复制公众号名到微信里搜索。</Text>
        </View>

        <View className={styles.notice}>
          <Text className={styles.noticeTitle}>💡 打开方式</Text>
          <Text className={styles.noticeBody}>1. 点击下方【关注公众号】；2. 在公众号历史消息中查看全部文章；3. 若组件不显示，可复制公众号名后在微信搜索。</Text>
        </View>

        <View className={styles.officialBlock}>
          <Text className={styles.officialLabel}>关注我们的公众号</Text>
          <View className={styles.officialCard}>
            <OfficialAccount />
          </View>
          <Text className={styles.officialHint}>* 微信原生组件仅在真机/体验版稳定展示</Text>
        </View>

        <View className={styles.infoCard}>
          <Text className={styles.infoTitle}>公众号信息</Text>
          <Text className={styles.infoText}>公众号名：{OFFICIAL_ACCOUNT_NAME}</Text>
          <Text className={styles.infoText}>gh_id：{OFFICIAL_ACCOUNT_ID}</Text>
        </View>

        <View className={styles.actions}>
          <Button
            className={`${styles.primaryBtn} ${copying ? styles.btnDisabled : ''}`}
            onClick={() => void copyText(OFFICIAL_ACCOUNT_NAME, '公众号名已复制')}
            disabled={copying}
          >
            {copying ? '已复制' : '复制公众号名'}
          </Button>
          <Button className={styles.secondaryBtn} openType="share" onClick={handleShare}>
            转发给朋友
          </Button>
          <Button className={styles.ghostBtn} onClick={handleBack}>
            返回
          </Button>
        </View>
      </View>
    );
  }

  if (!rawUrl) {
    return (
      <View className={styles.page}>
        <View className={styles.emptyState}>
          <Text className={styles.emptyText}>无效的文章链接</Text>
          <Button className={styles.primaryBtn} onClick={handleBack}>返回</Button>
        </View>
      </View>
    );
  }

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.tag}>公众号文章</Text>
        <Text className={styles.title}>{title}</Text>
        {metaLine ? <Text className={styles.meta}>{metaLine}</Text> : null}
      </View>

      {rawCover ? (
        <View className={styles.coverWrapper}>
          <Image className={styles.cover} src={rawCover} mode="widthFix" lazyLoad />
        </View>
      ) : null}

      {rawExcerpt ? (
        <View className={styles.excerptCard}>
          <Text className={styles.excerptText}>{rawExcerpt}</Text>
        </View>
      ) : null}

      <View className={styles.notice}>
        <Text className={styles.noticeTitle}>💡 为什么不能直接打开？</Text>
        <Text className={styles.noticeBody}>微信官方不允许小程序内直接打开公众号文章页。你可以通过关注公众号、复制文章链接或转发给朋友的方式继续查看。</Text>
      </View>

      <View className={styles.officialBlock}>
        <Text className={styles.officialLabel}>关注我们的公众号</Text>
        <View className={styles.officialCard}>
          <OfficialAccount />
        </View>
        <Text className={styles.officialHint}>* 公众号：{OFFICIAL_ACCOUNT_NAME}（{OFFICIAL_ACCOUNT_ID}）</Text>
      </View>

      <View className={styles.actions}>
        <Button
          className={`${styles.primaryBtn} ${copying ? styles.btnDisabled : ''}`}
          onClick={() => void copyText(rawUrl, '链接已复制，可粘贴到微信打开')}
          disabled={copying}
        >
          {copying ? '已复制' : '复制文章链接'}
        </Button>
        <Button className={styles.secondaryBtn} openType="share" onClick={handleShare}>
          转发给朋友
        </Button>
        <Button className={styles.ghostBtn} onClick={handleBack}>
          返回
        </Button>
      </View>

      <View className={styles.footerTip}>
        <Text className={styles.footerText}>链接：{rawUrl}</Text>
      </View>
    </View>
  );
};

export default StoryWebViewPage;
