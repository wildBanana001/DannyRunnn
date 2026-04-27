import { Card, Col, Form, Input, Row, Select } from 'antd';
import type { ActivityFormValues } from './formTypes';

interface ActivityBasicSectionProps {
  categoryOptions: Array<{ label: string; value: string }>;
}

function ActivityBasicSection({ categoryOptions }: ActivityBasicSectionProps) {
  return (
    <Card bordered={false} title="基本信息">
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item<ActivityFormValues>
            label="标题"
            name="title"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入活动标题" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item<ActivityFormValues>
            label="分类"
            name="category"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select options={categoryOptions} placeholder="请选择活动分类" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item<ActivityFormValues>
            label="状态"
            name="status"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select
              options={[
                { label: '未开始', value: 'upcoming' },
                { label: '进行中', value: 'ongoing' },
                { label: '已结束', value: 'ended' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item<ActivityFormValues>
            label="简介"
            name="description"
            rules={[{ required: true, message: '请输入简介' }]}
          >
            <Input.TextArea rows={2} placeholder="请输入活动简介" />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item<ActivityFormValues>
            label="详细描述"
            name="fullDescription"
            rules={[{ required: true, message: '请输入详细描述' }]}
          >
            <Input.TextArea rows={6} placeholder="请输入活动详细描述" />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
}

export default ActivityBasicSection;
