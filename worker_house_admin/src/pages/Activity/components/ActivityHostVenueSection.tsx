import { Card, Col, Form, Input, Row } from 'antd';
import ImageUploader from '@/components/ImageUploader';
import type { ActivityFormValues } from './formTypes';

function ActivityHostVenueSection() {
  return (
    <Card bordered={false} title="主办方与场地">
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item<ActivityFormValues>
            label="主办方名称"
            name="hostName"
            rules={[{ required: true, message: '请输入主办方名称' }]}
          >
            <Input placeholder="请输入主办方名称" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item<ActivityFormValues>
            label="主办方头像"
            name="hostAvatar"
            rules={[{ required: true, message: '请维护主办方头像' }]}
          >
            <ImageUploader helperText="支持上传或手动填 URL，兼容已有 cloud:// 值。" />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item<ActivityFormValues>
            label="主办方介绍"
            name="hostDescription"
            rules={[{ required: true, message: '请输入主办方介绍' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入主办方介绍" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item<ActivityFormValues>
            label="场地名称"
            name="venueName"
            rules={[{ required: true, message: '请输入场地名称' }]}
          >
            <Input placeholder="请输入场地名称" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item<ActivityFormValues>
            label="场地介绍"
            name="venueDescription"
            rules={[{ required: true, message: '请输入场地介绍' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入场地介绍" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item<ActivityFormValues> label="场地图片" name="venueImages">
        <ImageUploader helperText="支持多图上传，可通过上下按钮调整展示顺序。" maxCount={8} multiple />
      </Form.Item>
    </Card>
  );
}

export default ActivityHostVenueSection;
