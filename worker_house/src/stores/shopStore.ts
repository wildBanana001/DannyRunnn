import Taro from '@tarojs/taro';
import { create } from 'zustand';
import { fetchShopProducts } from '@/services/shop';
import { findMockProduct, mockProducts } from '@/mocks/shop';
import type { Order, OrderItem, OrderStatus, Product } from '@/types/shop';

const ORDERS_STORAGE_KEY = 'shop_orders';

interface CreateOrderInput {
  product: Product;
  quantity: number;
  addressId?: string;
  remark?: string;
}

interface ShopState {
  products: Product[];
  productsLoaded: boolean;
  currentProduct: Product | null;
  /** 待支付订单（下单未支付时暂存） */
  currentOrder: Order | null;
  orderList: Order[];
  /** 拉取商品：优先 BFF，失败降级 mock */
  fetchProducts: (force?: boolean) => Promise<Product[]>;
  /** 选中商品（详情/下单用），本地找不到时回退 mock */
  selectProduct: (id: string) => Product | null;
  /** 创建待支付订单 */
  createOrder: (input: CreateOrderInput) => Order;
  /** 支付成功后落库订单 */
  finalizeOrder: (status: OrderStatus) => Order | null;
  /** 清除待支付订单 */
  clearCurrentOrder: () => void;
  /** 从缓存恢复订单列表 */
  bootstrapOrders: () => void;
}

function persistOrders(orders: Order[]) {
  try {
    Taro.setStorageSync(ORDERS_STORAGE_KEY, orders);
  } catch (error) {
    console.warn('[shopStore] persistOrders failed', error);
  }
}

function buildOrderItem(product: Product, quantity: number): OrderItem {
  return {
    product,
    quantity,
    subtotal: Number((product.price * quantity).toFixed(2)),
  };
}

export const useShopStore = create<ShopState>((set, get) => ({
  products: [],
  productsLoaded: false,
  currentProduct: null,
  currentOrder: null,
  orderList: [],

  fetchProducts: async (force = false) => {
    if (!force && get().productsLoaded && get().products.length > 0) {
      return get().products;
    }
    try {
      const remote = await fetchShopProducts();
      if (remote && remote.length > 0) {
        set({ products: remote, productsLoaded: true });
        return remote;
      }
      // 远程为空也降级到 mock，保证页面有内容
      set({ products: mockProducts, productsLoaded: true });
      return mockProducts;
    } catch (error) {
      // 404 / 网络错误 → 兜底 mock
      console.warn('[shopStore] fetchProducts fallback to mock', error);
      set({ products: mockProducts, productsLoaded: true });
      return mockProducts;
    }
  },

  selectProduct: (id) => {
    const fromList = get().products.find((item) => item.id === id);
    const product = fromList ?? findMockProduct(id) ?? null;
    set({ currentProduct: product });
    return product;
  },

  createOrder: ({ product, quantity, addressId, remark }) => {
    const item = buildOrderItem(product, quantity);
    const order: Order = {
      id: `order_${Date.now()}`,
      items: [item],
      totalAmount: item.subtotal,
      status: 'pending',
      createdAt: new Date().toISOString(),
      paymentMethod: 'wechat',
      addressId,
      remark,
    };
    set({ currentOrder: order });
    return order;
  },

  finalizeOrder: (status) => {
    const { currentOrder, orderList } = get();
    if (!currentOrder) {
      return null;
    }
    const finalized: Order = { ...currentOrder, status };
    const nextList = [finalized, ...orderList];
    set({ orderList: nextList, currentOrder: null });
    persistOrders(nextList);
    return finalized;
  },

  clearCurrentOrder: () => set({ currentOrder: null }),

  bootstrapOrders: () => {
    try {
      const cached = Taro.getStorageSync<Order[]>(ORDERS_STORAGE_KEY);
      if (Array.isArray(cached) && cached.length > 0) {
        set({ orderList: cached });
      }
    } catch (error) {
      console.warn('[shopStore] bootstrapOrders failed', error);
    }
  },
}));
