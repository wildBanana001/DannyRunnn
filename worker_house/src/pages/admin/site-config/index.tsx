import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Form from '@nutui/nutui-react-taro/dist/es/packages/form/index';
import FormItem from '@nutui/nutui-react-taro/dist/es/packages/formitem/index';
import Input from '@nutui/nutui-react-taro/dist/es/packages/input/index';
import TextArea from '@nutui/nutui-react-taro/dist/es/packages/textarea/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '@nutui/nutui-react-taro/dist/style.css';
import { uploadAdminCoverImage } from '@/services/admin';
import { defaultSiteConfigRecord, fetchCommunitySiteConfig, type SiteConfigRecord, updateCommunitySiteConfig } from '@/services/siteConfig';
import styles from './index.module.scss';

const toastId = 'admin-site-config-toast';

const AdminSiteConfigPage: React.FC = () => {
  const [config, setConfig] = useState<SiteConfigRecord>(defaultSiteConfigRecord);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const result = await fetchCommunitySiteConfig();
      setConfig(result ?? defaultSiteConfigRecord);
    } catch (error) {
      const message = error instanceof Error ? error.message : '配置加载失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '站点配置' });
    void loadConfig();
  }, []);

  const updateField = (key: keyof SiteConfigRecord, value: string) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const handleChooseQrcode = async () => {
    try {
      const result = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed', 'original'],
        sourceType: ['album', 'camera'],
      });
      const filePath = result.tempFilePaths?.[0];
      if (!filePath) {
        return;
      }

      setUploading(true);
      const uploaded = await uploadAdminCoverImage(filePath);
      setConfig((current) => ({ ...current, communityQrcode: uploaded.url }));
      Toast.show(toastId, { content: '二维码已上传，记得保存', icon: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '二维码上传失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextConfig = await updateCommunitySiteConfig({
        aboutUs: config.aboutUs,
        communityQrcode: config.communityQrcode,
        contactWechat: config.contactWechat,
        heroSlogan: config.heroSlogan,
        heroTitle: config.heroTitle,
      });
      setConfig(nextConfig);
      Toast.show(toastId, { content: '站点配置已保存', icon: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '站点配置保存失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setSaving(false);
    }
  };

  const formatUpdatedAt = (value: string) => {
    if (!value) {
      return '尚未记录更新时间';
    }
    return value.replace('T', ' ').slice(0, 16);
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.heroCard}>
        <Text className={styles.title}>站点配置</Text>
        <Text className={styles.description}>用于维护首页 Hero、报名支付微信号、关于我们与加入社群二维码。</Text>
      </View>

      <View className={styles.contentCard}>
        <View className={styles.qrBlock}>
          {config.communityQrcode ? (
            <Image className={styles.qrImage} src={config.communityQrcode} mode="aspectFit" />
          ) : (
            <View className={styles.qrPlaceholder}>
              <Text className={styles.qrPlaceholderText}>{loading ? '配置加载中…' : '暂未配置二维码'}</Text>
            </View>
          )}
        </View>
        <Button type="primary" loading={uploading} onClick={() => void handleChooseQrcode()}>
          {uploading ? '上传中…' : '更换二维码'}
        </Button>
      </View>

      <Form className={styles.contentCard}>
        <FormItem label="收款微信号">
          <Input value={config.contactWechat} placeholder="请输入收款微信号" onChange={(value) => updateField('contactWechat', value)} />
        </FormItem>
        <FormItem label="Hero 标题">
          <Input value={config.heroTitle} placeholder="请输入首页标题" onChange={(value) => updateField('heroTitle', value)} />
        </FormItem>
        <FormItem label="Hero 副标题">
          <Input value={config.heroSlogan} placeholder="请输入首页副标题" onChange={(value) => updateField('heroSlogan', value)} />
        </FormItem>
        <FormItem label="关于我们">
          <TextArea value={config.aboutUs} placeholder="请输入关于我们文案" onChange={(value) => updateField('aboutUs', value)} />
        </FormItem>
      </Form>

      <View className={styles.contentCard}>
        <View className={styles.meta}>
          <Text className={styles.metaText}>最近更新：{formatUpdatedAt(config.updatedAt)}</Text>
          <Text className={styles.metaText}>更新人：{config.updatedBy || '未记录'}</Text>
        </View>
        <Button type="primary" loading={saving} onClick={() => void handleSave()}>
          {saving ? '保存中…' : '保存配置'}
        </Button>
      </View>

      <Toast id={toastId} />
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminSiteConfigPage;
