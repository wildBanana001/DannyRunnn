// 商城（shop）分包数据类型定义
// 与 BFF /api/shop/* 接口对齐；未接入时由 src/mocks/shop.ts 兜底

/** 商品角标类型：NEW（新品）/ HOT（热销），空则不展示贴纸 */
export type ProductBadge = 'NEW' | 'HOT';

/** 订单状态：待付款 / 已完成 / 已取消 */
export type OrderStatus = 'pending' | 'completed' | 'cancelled';

/** 支付方式 */
export type PaymentMethod = 'wechat' | 'mock';

/** 商品 */
export interface Product {
  id: string;
  name: string;
  /** 现价（元） */
  price: number;
  /** 原价（元），存在时展示删除线 */
  originalPrice?: number;
  /** 商品主图 URL（远程） */
  imageUrl: string;
  /** 商品简介 */
  description: string;
  /** 库存 */
  stock: number;
  /** 标签，如 ['社畜好物', '限量'] */
  tags?: string[];
  /** 角标贴纸：NEW / HOT */
  badge?: ProductBadge;
}

/** 订单商品条目 */
export interface OrderItem {
  product: Product;
  /** 购买数量 */
  quantity: number;
  /** 小计（price * quantity） */
  subtotal: number;
}

/** 订单 */
export interface Order {
  id: string;
  items: OrderItem[];
  /** 合计金额（元） */
  totalAmount: number;
  status: OrderStatus;
  /** 创建时间 ISO 字符串 */
  createdAt: string;
  /** 支付方式 */
  paymentMethod?: PaymentMethod;
  /** 收货地址 id */
  addressId?: string;
  /** 买家备注 */
  remark?: string;
}
