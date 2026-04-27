import { Card, Form, Select, Typography } from 'antd';
import ImageUploader from '@/components/ImageUploader';
import type { ActivityFormValues } from './formTypes';

function requireAtLeastOneImage(_: unknown, value: string[] | undefined) {
  if (Array.isArray(value) && value.some((item) => item.trim())) {
    return Promise.resolve();
  }

  return Promise.reject(new Error('请至少维护一张图片'));
}

function ActivityMediaSection() {
  return (
    <Card bordered={false} title="封面与相册">
      <Form.Item<ActivityFormValues>
        label="封面图组"
        name="covers"
        rules={[{ validator: requireAtLeastOneImage }]}
      >
        <ImageUploader
          helperText="支持上传多张封面图并调整顺序，首图会自动同步到 cover / coverImage，也支持手动填 URL 兜底。"
          maxCount={8}
          multiple
        />
      </Form.Item>
      <Typography.Text type="secondary">
        建议第一张放置活动主视觉，列表页和小程序兼容字段都会优先取首图展示。
      </Typography.Text>
      <div style={{ height: 12 }} />
      <Form.Item<ActivityFormValues> label="相册" name="gallery">
        <ImageUploader helperText="支持上传或手动填 URL，适合放现场氛围图。" maxCount={12} multiple />
      </Form.Item>
      <Form.Item<ActivityFormValues> label="标签" name="tags">
        <Select mode="tags" placeholder="请输入标签后回车确认" tokenSeparators={[',']} />
      </Form.Item>
    </Card>
  );
}

export default ActivityMediaSection;
