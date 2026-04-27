import React, { useState } from 'react';
import { Image, Input, Switch, Text, Textarea, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import Button from '@/components/Button';
import { createWallPost } from '@/cloud/services';
import { uploadPostImage } from '@/services/upload';
import type { PostColor } from '@/types/post';
import styles from './index.module.scss';

const colorOptions: Array<{ key: PostColor; label: string }> = [
  { key: 'yellow', label: '黄' },
  { key: 'pink', label: '粉' },
  { key: 'blue', label: '蓝' },
  { key: 'green', label: '绿' },
  { key: 'orange', label: '橙' },
  { key: 'purple', label: '紫' }
];

const tagOptions = ['社畜', '日常', '吐槽', '其他'] as const;
type TagOption = (typeof tagOptions)[number];

interface LocalImage {
  localPath: string;
  url: string;
}

const MAX_IMAGES = 9;

const WallPublishPage: React.FC = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState<PostColor>('yellow');
  const [selectedTag, setSelectedTag] = useState<TagOption | ''>('');
  const [customTag, setCustomTag] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [images, setImages] = useState<LocalImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectTag = (tag: TagOption) => {
    setSelectedTag((current) => (current === tag ? '' : tag));
  };

  const handleChooseImages = async () => {
    if (images.length >= MAX_IMAGES) {
      Taro.showToast({ title: '最多选择 9 张图片', icon: 'none' });
      return;
    }

    try {
      const remaining = MAX_IMAGES - images.length;
      const result = await Taro.chooseMedia({
        count: remaining,
        mediaType: ['image'],
      });

      const tempFiles = (result.tempFiles ?? []) as Array<{ tempFilePath?: string } & Record<string, any>>;
      if (!tempFiles.length) {
        return;
      }

      setIsUploading(true);
      const nextImages: LocalImage[] = [];

      for (const file of tempFiles) {
        const filePath = file.tempFilePath;
        if (!filePath) {
          // eslint-disable-next-line no-continue
          continue;
        }

        try {
          const uploaded = await uploadPostImage(filePath);
          nextImages.push({
            localPath: filePath,
            url: uploaded.url,
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('[wall-publish] 图片上传失败', error);
          Taro.showToast({ title: '部分图片上传失败', icon: 'none' });
        }
      }

      if (nextImages.length) {
        setImages((current) => [...current, ...nextImages].slice(0, MAX_IMAGES));
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[wall-publish] 选择图片失败', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Taro.showToast({ title: '先给这条留言起个标题吧', icon: 'none' });
      return;
    }

    if (!content.trim()) {
      Taro.showToast({ title: '先写点内容吧', icon: 'none' });
      return;
    }

    let finalTag = '';
    if (selectedTag === '其他') {
      const value = customTag.trim();
      if (!value) {
        Taro.showToast({ title: '请输入自定义标签', icon: 'none' });
        return;
      }
      if (value.length > 10) {
        Taro.showToast({ title: '自定义标签最多 10 个字符', icon: 'none' });
        return;
      }
      finalTag = value;
    } else if (selectedTag) {
      finalTag = selectedTag;
    }

    const imageUrls = images.map((item) => item.url).filter(Boolean);

    setIsSubmitting(true);
    try {
      await createWallPost({
        title: title.trim(),
        content: content.trim(),
        images: imageUrls,
        isAnonymous,
        tags: finalTag ? [finalTag] : [],
        color: selectedColor,
      });
      Taro.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => {
        Taro.navigateBack();
      }, 400);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className={styles.container}>
      <View className={styles.sectionCard}>
        <Text className={styles.label}>标题</Text>
        <Input
          className={styles.titleInput}
          maxlength={24}
          placeholder="给这条留言起个小标题"
          value={title}
          onInput={(event) => setTitle(event.detail.value)}
        />
      </View>

      <View className={`${styles.previewNote} ${styles[selectedColor]}`}>
        <Textarea
          className={styles.textarea}
          maxlength={300}
          placeholder="把今天的心情写在这里吧……"
          value={content}
          onInput={(event) => setContent(event.detail.value)}
        />
      </View>

      <View className={styles.sectionCard}>
        <Text className={styles.label}>便利贴颜色</Text>
        <View className={styles.colorRow}>
          {colorOptions.map((item) => (
            <View
              key={item.key}
              className={`${styles.colorDot} ${styles[`dot-${item.key}`]} ${selectedColor === item.key ? styles.colorDotActive : ''}`}
              onClick={() => setSelectedColor(item.key)}
            >
              <Text className={styles.colorText}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className={styles.sectionCard}>
        <Text className={styles.label}>标签</Text>
        <View className={styles.tags}>
          {tagOptions.map((tag) => {
            const isActive = selectedTag === tag;
            return (
              <View
                key={tag}
                className={`${styles.tagChip} ${isActive ? styles.tagChipActive : ''}`}
                onClick={() => handleSelectTag(tag)}
              >
                <Text className={`${styles.tagText} ${isActive ? styles.tagTextActive : ''}`}>{tag}</Text>
              </View>
            );
          })}
        </View>
        {selectedTag === '其他' && (
          <View className={styles.customTagRow}>
            <Input
              className={styles.titleInput}
              maxlength={10}
              placeholder="输入自定义标签，最多 10 个字"
              value={customTag}
              onInput={(event) => setCustomTag(event.detail.value)}
            />
          </View>
        )}
      </View>

      <View className={styles.sectionCard}>
        <Text className={styles.label}>图片（最多 9 张）</Text>
        <View className={styles.imageGrid}>
          {images.map((item, index) => (
            <View key={item.url || item.localPath} className={styles.imageItem}>
              <Image className={styles.imageThumb} src={item.url || item.localPath} mode="aspectFill" />
              <View className={styles.imageRemove} onClick={() => handleRemoveImage(index)}>
                <Text>x</Text>
              </View>
            </View>
          ))}
          {images.length < MAX_IMAGES && (
            <View className={styles.imageAdd} onClick={() => void handleChooseImages()}>
              <Text className={styles.imageAddIcon}>{isUploading ? '…' : '+'}</Text>
              <Text className={styles.imageAddText}>{isUploading ? '上传中…' : '添加图片'}</Text>
            </View>
          )}
        </View>
      </View>

      <View className={styles.sectionRow}>
        <Text className={styles.label}>匿名发布</Text>
        <Switch checked={isAnonymous} color="#E60000" onChange={(event) => setIsAnonymous(event.detail.value)} />
      </View>

      <View className={styles.actionBar}>
        <Button type="primary" size="large" block loading={isSubmitting || isUploading} onClick={handleSubmit}>
          发布
        </Button>
      </View>
    </View>
  );
};

export default WallPublishPage;
