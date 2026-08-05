export const shopProductImages: Record<string, string> = {
  'bottled-water-550ml': require('./product-water.jpg'),
  'cocktail-afterwork-sour': require('./cocktail-afterwork-sour.jpg'),
  'cocktail-mint-mojito': require('./cocktail-mint-mojito.jpg'),
  'cocktail-berry-fizz': require('./cocktail-berry-fizz.jpg'),
  'cocktail-sunset-highball': require('./cocktail-sunset-highball.jpg'),
  'cocktail-espresso-martini': require('./cocktail-espresso-martini.jpg'),
  'cocktail-elderflower-zero': require('./cocktail-elderflower-zero.jpg'),
  'prod-coffee-box': require('./product-coffee.jpg'),
  'prod-fish-tote': require('./product-tote.jpg'),
  'prod-stress-ball': require('./product-stress-ball.jpg'),
  'prod-thermos-cup': require('./product-thermos.jpg'),
  'prod-monday-stickers': require('./product-stickers.jpg'),
  'prod-off-work-slippers': require('./product-slippers.jpg'),
};

export function resolveShopProductImage(productId: string, remoteImage = '') {
  return shopProductImages[productId] || remoteImage || shopProductImages['bottled-water-550ml'];
}
