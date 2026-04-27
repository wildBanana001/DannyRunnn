import { Card, Col, DatePicker, Form, Input, InputNumber, Row, Switch, TimePicker } from 'antd';
import type { ActivityFormValues } from './formTypes';

function ActivityScheduleSection() {
  return (
    <>
      <Card bordered={false} title="时间地点">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item<ActivityFormValues>
              label="开始日期"
              name="startDate"
              rules={[{ required: true, message: '请选择开始日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item<ActivityFormValues>
              label="结束日期"
              name="endDate"
              rules={[{ required: true, message: '请选择结束日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item<ActivityFormValues>
              label="开始时间"
              name="startTime"
              rules={[{ required: true, message: '请选择开始时间' }]}
            >
              <TimePicker format="HH:mm" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item<ActivityFormValues>
              label="结束时间"
              name="endTime"
              rules={[{ required: true, message: '请选择结束时间' }]}
            >
              <TimePicker format="HH:mm" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item<ActivityFormValues>
              label="地点"
              name="location"
              rules={[{ required: true, message: '请输入地点' }]}
            >
              <Input placeholder="例如：静安区 / 莫干山" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item<ActivityFormValues>
              label="详细地址"
              name="address"
              rules={[{ required: true, message: '请输入详细地址' }]}
            >
              <Input placeholder="请输入详细地址" />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card bordered={false} title="费用人数">
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item<ActivityFormValues>
              label="活动费用（元）"
              name="price"
              rules={[{ required: true, message: '请输入价格' }]}
            >
              <InputNumber addonBefore="¥" min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item<ActivityFormValues> label="原价" name="originalPrice">
              <InputNumber addonBefore="¥" min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item<ActivityFormValues>
              label="最大人数"
              name="maxParticipants"
              rules={[{ required: true, message: '请输入最大人数' }]}
            >
              <InputNumber min={1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item<ActivityFormValues>
              label="是否可用社畜次卡抵扣"
              name="cardEligible"
              valuePropName="checked"
            >
              <Switch checkedChildren="可用" unCheckedChildren="不可用" />
            </Form.Item>
          </Col>
        </Row>
      </Card>
    </>
  );
}

export default ActivityScheduleSection;
