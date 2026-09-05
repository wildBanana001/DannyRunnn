export type AdminFulfillmentTaskKind = 'activity' | 'shop';
export type AdminFulfillmentTaskAction = 'fulfill' | 'retry';

export interface AdminIdentity {
  isAdmin: boolean;
  openid: string;
}

export interface AdminFulfillmentTask {
  action: AdminFulfillmentTaskAction;
  amount: number;
  createdAt: string;
  fulfillmentLabel: string;
  fulfillmentStatus: 'pending' | 'fulfilled';
  id: string;
  kind: AdminFulfillmentTaskKind;
  paidAt: string;
  participantContact: string;
  participantName: string;
  quantity: number;
  remark: string;
  title: string;
  unitLabel: string;
  wechatShippingAttempts: number;
  wechatShippingError: string;
  wechatShippingStatus: 'not_required' | 'pending' | 'reporting' | 'reported' | 'failed';
}
