import { Card, Form, Input } from 'antd';
import DynamicListField from '@/components/DynamicListField';
import type { ActivityFormValues } from './formTypes';

function ActivityOtherSection() {
  return (
    <Card bordered={false} title="其他信息">
      <DynamicListField addText="添加报名要求" label="报名要求" name="requirements" placeholder="请输入报名要求" />
      <DynamicListField addText="添加活动包含项" label="活动包含项" name="includes" placeholder="请输入包含项" />
      <Form.Item<ActivityFormValues> label="退款政策" name="refundPolicy">
        <Input.TextArea rows={4} placeholder="请输入退款政策" />
      </Form.Item>
    </Card>
  );
}

export default ActivityOtherSection;
