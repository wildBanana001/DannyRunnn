export const shopProductImages: Record<string, string> = {
  'prod-coffee-box': require('./product-coffee.jpg'),
  'prod-fish-tote': require('./product-tote.jpg'),
  'prod-stress-ball': require('./product-stress-ball.jpg'),
  'prod-thermos-cup': require('./product-thermos.jpg'),
  'prod-monday-stickers': require('./product-stickers.jpg'),
  'prod-off-work-slippers': require('./product-slippers.jpg'),
};

export function resolveShopProductImage(productId: string, remoteImage = '') {
  return shopProductImages[productId] || remoteImage || shopProductImages['prod-coffee-box'];
}
