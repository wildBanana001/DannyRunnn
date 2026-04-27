import {
  DeleteOutlined,
  EyeOutlined,
  LoadingOutlined,
  PlusOutlined,
  UpOutlined,
  DownOutlined,
} from '@ant-design/icons';
import type { UploadRequestOption as RcCustomRequestOptions } from 'rc-upload/lib/interface';
import { Button, Input, Space, Typography, Upload, message } from 'antd';
import { useMemo, useState } from 'react';
import { getAdminUploadEndpoint, uploadImageFile } from '@/services/upload';
import { compressImageFile } from './imageCompression';

interface ImageUploaderProps {
  disabled?: boolean;
  helperText?: string;
  maxCount?: number;
  multiple?: boolean;
  onChange?: (value: string | string[]) => void;
  value?: string | string[];
}

function normalizeValues(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    return [value];
  }

  return [];
}

function canPreview(url: string) {
  return /^https?:\/\//.test(url.trim());
}

function updateAt(list: string[], index: number, nextValue: string) {
  const nextList = [...list];
  nextList[index] = nextValue;
  return nextList;
}

function removeAt(list: string[], index: number) {
  return list.filter((_, itemIndex) => itemIndex !== index);
}

function moveItem(list: string[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= list.length) {
    return list;
  }

  const nextList = [...list];
  const [target] = nextList.splice(index, 1);
  nextList.splice(nextIndex, 0, target);
  return nextList;
}

function createValueEntries(values: string[]) {
  const occurrenceMap = new Map<string, number>();

  return values.map((item) => {
    const occurrence = occurrenceMap.get(item) ?? 0;
    occurrenceMap.set(item, occurrence + 1);
    const normalizedKey = item.trim() ? item.trim() : 'empty';

    return {
      key: `${normalizedKey}-${occurrence}`,
      value: item,
    };
  });
}

function ImageUploader({
  disabled = false,
  helperText,
  maxCount,
  multiple = false,
  onChange,
  value,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const values = useMemo(() => normalizeValues(value), [value]);
  const editableValues = useMemo(() => (multiple ? values : [values[0] ?? '']), [multiple, values]);
  const valueEntries = useMemo(() => createValueEntries(editableValues), [editableValues]);
  const uploadEndpoint = useMemo(() => getAdminUploadEndpoint(), []);

  const emitChange = (nextValues: string[]) => {
    if (multiple) {
      onChange?.(nextValues.map((item) => item.trim()).filter(Boolean));
      return;
    }

    onChange?.(nextValues[0]?.trim() ?? '');
  };

  const appendValue = (nextValue: string) => {
    const normalizedValue = nextValue.trim();
    if (!normalizedValue) {
      return;
    }

    if (!multiple) {
      emitChange([normalizedValue]);
      return;
    }

    if (maxCount && values.length >= maxCount) {
      message.warning(`最多支持上传 ${maxCount} 张图片`);
      return;
    }

    emitChange([...values, normalizedValue]);
  };

  const handleUpload = async (options: RcCustomRequestOptions) => {
    const originalFile = options.file as File;
    setUploading(true);

    try {
      const compressedFile = await compressImageFile(originalFile, 1200, 0.8);
      const result = await uploadImageFile(compressedFile);
      appendValue(result.url);
      message.success('图片上传成功');
      options.onSuccess?.(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '图片上传失败';
      message.error(errorMessage);
      options.onError?.(new Error(errorMessage));
    } finally {
      setUploading(false);
    }
  };

  const canAddMore = !disabled && (!multiple || !maxCount || values.length < maxCount);

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Upload
        accept="image/*"
        action={uploadEndpoint}
        customRequest={handleUpload}
        disabled={!canAddMore}
        listType="picture-card"
        multiple={multiple}
        showUploadList={false}
      >
        <Space direction="vertical" size={4} style={{ alignItems: 'center' }}>
          {uploading ? <LoadingOutlined /> : <PlusOutlined />}
          <Typography.Text style={{ color: '#E63946' }}>
            {uploading ? '上传中...' : '上传图片'}
          </Typography.Text>
        </Space>
      </Upload>

      {helperText ? <Typography.Text type="secondary">{helperText}</Typography.Text> : null}

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {valueEntries.map((entry, index) => {
          const item = entry.value;
          const previewable = canPreview(item);
          const previewTitle = previewable ? '预览' : '仅支持预览 https 图片';

          return (
            <div
              key={entry.key}
              style={{
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                display: 'grid',
                gap: 12,
                gridTemplateColumns: '96px 1fr auto',
                padding: 12,
                width: '100%',
              }}
            >
              <div
                style={{
                  alignItems: 'center',
                  backgroundColor: '#fafafa',
                  borderRadius: 8,
                  display: 'flex',
                  height: 96,
                  justifyContent: 'center',
                  overflow: 'hidden',
                  width: 96,
                }}
              >
                {previewable ? (
                  <img alt="上传图片预览" src={item} style={{ height: '100%', objectFit: 'cover', width: '100%' }} />
                ) : (
                  <Typography.Text type="secondary">暂无预览</Typography.Text>
                )}
              </div>

              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Input
                  disabled={disabled}
                  placeholder={multiple ? `第 ${index + 1} 张图片 URL` : '请输入图片 URL'}
                  value={item}
                  onChange={(event) => emitChange(updateAt(editableValues, index, event.target.value))}
                />
                <Typography.Text type="secondary">
                  兼容历史 URL / cloud:// 值；上传成功后会自动替换为 https 地址。
                </Typography.Text>
              </Space>

              <Space direction="vertical" size={8}>
                <Button
                  disabled={!previewable}
                  icon={<EyeOutlined />}
                  title={previewTitle}
                  onClick={() => window.open(item, '_blank', 'noopener,noreferrer')}
                />
                {multiple ? (
                  <>
                    <Button disabled={disabled || index === 0} icon={<UpOutlined />} onClick={() => emitChange(moveItem(values, index, -1))} />
                    <Button
                      disabled={disabled || index === values.length - 1}
                      icon={<DownOutlined />}
                      onClick={() => emitChange(moveItem(values, index, 1))}
                    />
                  </>
                ) : null}
                <Button
                  danger
                  disabled={disabled || (!multiple && !item.trim())}
                  icon={<DeleteOutlined />}
                  onClick={() => emitChange(multiple ? removeAt(values, index) : [''])}
                />
              </Space>
            </div>
          );
        })}

        {multiple ? (
          <Button disabled={disabled} type="dashed" onClick={() => emitChange([...values, ''])}>
            手动添加 URL
          </Button>
        ) : null}

        {multiple && values.length === 0 ? <Typography.Text type="secondary">暂无图片，支持上传或手动录入。</Typography.Text> : null}
      </Space>
    </Space>
  );
}

export default ImageUploader;
