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
import {
  defaultSiteConfigRecord,
  fetchCommunitySiteConfig,
  type HomeOwnerCard,
  type SiteConfigRecord,
  updateCommunitySiteConfig,
} from '@/services/siteConfig';
import styles from './index.module.scss';

const toastId = 'admin-site-config-toast';

type StringField = 'aboutUs' | 'communityQrcode' | 'contactWechat' | 'heroSlogan' | 'heroTitle'
  | 'homeCopyLead' | 'homeCopyBody' | 'homeChannelsFinder' | 'homeOfficialAccountId' | 'homeOfficialAccountName';

const AdminSiteConfigPage: React.FC = () => {
  const [config, setConfig] = useState<SiteConfigRecord>(defaultSiteConfigRecord);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [spaceImageUploading, setSpaceImageUploading] = useState(false);
  const [ownerAvatarUploadingId, setOwnerAvatarUploadingId] = useState<string>('');

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

  const updateField = (key: StringField, value: string) => {
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

  const handleAddSpaceImage = async () => {
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

      setSpaceImageUploading(true);
      const uploaded = await uploadAdminCoverImage(filePath);
      setConfig((current) => ({
        ...current,
        homeSpaceImages: [...(current.homeSpaceImages || []), uploaded.url],
      }));
      Toast.show(toastId, { content: '已添加，记得保存', icon: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片上传失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setSpaceImageUploading(false);
    }
  };

  const handleRemoveSpaceImage = (index: number) => {
    setConfig((current) => {
      const next = [...(current.homeSpaceImages || [])];
      next.splice(index, 1);
      return { ...current, homeSpaceImages: next };
    });
  };

  const updateOwner = (id: string, key: keyof HomeOwnerCard, value: string) => {
    setConfig((current) => ({
      ...current,
      homeOwners: (current.homeOwners || []).map((owner) => (owner.id === id ? { ...owner, [key]: value } : owner)),
    }));
  };

  const handleAddOwner = () => {
    const id = `owner-${Date.now()}`;
    setConfig((current) => ({
      ...current,
      homeOwners: [...(current.homeOwners || []), { id, avatar: '', label: '', description: '' }],
    }));
  };

  const handleRemoveOwner = (id: string) => {
    setConfig((current) => ({
      ...current,
      homeOwners: (current.homeOwners || []).filter((owner) => owner.id !== id),
    }));
  };

  const handleChooseOwnerAvatar = async (id: string) => {
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

      setOwnerAvatarUploadingId(id);
      const uploaded = await uploadAdminCoverImage(filePath);
      updateOwner(id, 'avatar', uploaded.url);
      Toast.show(toastId, { content: '头像已上传，记得保存', icon: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '头像上传失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setOwnerAvatarUploadingId('');
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
        homeCopyLead: config.homeCopyLead,
        homeCopyBody: config.homeCopyBody,
        homeChannelsFinder: config.homeChannelsFinder,
        homeOfficialAccountId: config.homeOfficialAccountId,
        homeOfficialAccountName: config.homeOfficialAccountName,
        homeSpaceImages: config.homeSpaceImages,
        homeOwners: config.homeOwners,
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

      <Form className={styles.contentCard}>
        <View className={styles.title}>首页快乐屋区文案</View>
        <FormItem label="文案首句 lead">
          <TextArea value={config.homeCopyLead} placeholder="例如：Hiiii这里是社畜没有派对！" onChange={(value) => updateField('homeCopyLead', value)} />
        </FormItem>
        <FormItem label="文案正文 body">
          <TextArea value={config.homeCopyBody} placeholder="一段关于空间介绍的文案" onChange={(value) => updateField('homeCopyBody', value)} />
        </FormItem>
        <FormItem label="视频号 finderUserName">
          <Input value={config.homeChannelsFinder} placeholder="例如：sph_worker_house_demo" onChange={(value) => updateField('homeChannelsFinder', value)} />
        </FormItem>
        <FormItem label="公众号 gh_id">
          <Input value={config.homeOfficialAccountId} placeholder="例如：gh_xxxxx" onChange={(value) => updateField('homeOfficialAccountId', value)} />
        </FormItem>
        <FormItem label="公众号名">
          <Input value={config.homeOfficialAccountName} placeholder="公众号名称" onChange={(value) => updateField('homeOfficialAccountName', value)} />
        </FormItem>
      </Form>

      <View className={styles.contentCard}>
        <View className={styles.title}>快乐屋轮播图</View>
        <Text className={styles.description}>建议尺寸 1125 x 750 等比，按顺序作为首页快乐屋区轮播。</Text>
        {(config.homeSpaceImages || []).length > 0 ? (
          <View>
            {(config.homeSpaceImages || []).map((image, index) => (
              <View key={`${image}-${index}`} style={{ marginTop: '16rpx', display: 'flex', alignItems: 'center', gap: '16rpx' }}>
                <Image src={image} mode="aspectFill" style={{ width: '160rpx', height: '160rpx', borderRadius: '12rpx', background: '#f3efe5' }} />
                <Button size="small" onClick={() => handleRemoveSpaceImage(index)}>删除</Button>
              </View>
            ))}
          </View>
        ) : (
          <Text className={styles.description}>暂未上传图片</Text>
        )}
        <View style={{ marginTop: '24rpx' }}>
          <Button type="primary" loading={spaceImageUploading} onClick={() => void handleAddSpaceImage()}>
            {spaceImageUploading ? '上传中…' : '添加图片'}
          </Button>
        </View>
      </View>

      <View className={styles.contentCard}>
        <View className={styles.title}>主理人卡片</View>
        {(config.homeOwners || []).map((owner) => (
          <View key={owner.id} style={{ marginTop: '24rpx', paddingTop: '24rpx', borderTop: '1rpx solid rgba(17,17,17,0.08)' }}>
            <View style={{ display: 'flex', alignItems: 'center', gap: '24rpx' }}>
              {owner.avatar ? (
                <Image src={owner.avatar} mode="aspectFill" style={{ width: '160rpx', height: '160rpx', borderRadius: '50%', background: '#f3efe5' }} />
              ) : (
                <View style={{ width: '160rpx', height: '160rpx', borderRadius: '50%', background: '#f3efe5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: '24rpx', color: '#5a4635' }}>暂无头像</Text>
                </View>
              )}
              <View style={{ display: 'flex', flexDirection: 'column', gap: '12rpx' }}>
                <Button
                  size="small"
                  type="primary"
                  loading={ownerAvatarUploadingId === owner.id}
                  onClick={() => void handleChooseOwnerAvatar(owner.id)}
                >
                  {ownerAvatarUploadingId === owner.id ? '上传中…' : '更换头像'}
                </Button>
                <Button size="small" onClick={() => handleRemoveOwner(owner.id)}>删除该主理人</Button>
              </View>
            </View>
            <Form>
              <FormItem label="名字 / 标签">
                <Input value={owner.label} placeholder="例如：橙子" onChange={(value) => updateOwner(owner.id, 'label', value)} />
              </FormItem>
              <FormItem label="自我介绍">
                <TextArea value={owner.description} placeholder="一段简短介绍" onChange={(value) => updateOwner(owner.id, 'description', value)} />
              </FormItem>
            </Form>
          </View>
        ))}
        <View style={{ marginTop: '24rpx' }}>
          <Button type="primary" onClick={handleAddOwner}>添加主理人</Button>
        </View>
      </View>

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
