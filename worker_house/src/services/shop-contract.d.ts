export type NormalizedShopFulfillmentType = 'delivery' | 'pickup' | 'onsite';

export interface NormalizedShopProduct {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
  description: string;
  tags: string[];
  category: string;
  fulfillmentType: NormalizedShopFulfillmentType;
  fulfillmentLabel: string;
  unitLabel: string;
  alcoholic: boolean;
  abv: number;
  volumeMl: number;
  shippingFee: number;
  minQuantity: number;
  maxQuantity: number;
  stock: number | null;
  enabled: boolean;
}

export interface ShopQuantityBounds {
  minQuantity: number;
  maxQuantity: number;
  canPurchase: boolean;
}

export interface ShopOrderPricing {
  amount: number;
  shippingFee: number;
  subtotal: number;
  unitPrice: number;
}

type ProductQuantityFields = Pick<NormalizedShopProduct, 'enabled' | 'maxQuantity' | 'minQuantity' | 'stock'>;
type ProductPricingFields = Pick<NormalizedShopProduct, 'price' | 'shippingFee'>;

export function normalizeShopProductPayload(value: unknown): NormalizedShopProduct;
export function getShopQuantityBounds(product: ProductQuantityFields): ShopQuantityBounds;
export function clampShopQuantity(product: ProductQuantityFields, value: number): number;
export function getShopProductQuantityIssue(product: ProductQuantityFields | null, quantity: number): string;
export function calculateShopOrderPricing(product: ProductPricingFields, quantity: number): ShopOrderPricing;
