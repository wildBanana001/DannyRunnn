'use strict';

const DEFAULT_MIN_QUANTITY = 1;
const DEFAULT_MAX_QUANTITY = 99;

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sanitizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function parseFiniteNumber(value) {
  if (
    value === undefined
    || value === null
    || typeof value === 'boolean'
    || (typeof value === 'string' && !value.trim())
  ) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeNonNegativeNumber(value, fallback = 0) {
  const parsed = parseFiniteNumber(value);
  return parsed === null ? fallback : Math.max(0, parsed);
}

function sanitizeBoundedInteger(value, fallback, minimum, maximum) {
  const parsed = parseFiniteNumber(value);
  if (parsed === null || !Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function parseRequiredCurrency(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const cents = value * 100;
  const roundedCents = Math.round(cents);
  return Number.isSafeInteger(roundedCents) && Math.abs(cents - roundedCents) < 1e-8
    ? value
    : null;
}

function parseRequiredQuantity(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 99
    ? value
    : null;
}

function parseRequiredStock(value) {
  if (value === null) return { valid: true, value: null };
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return { valid: true, value };
  }
  return { valid: false, value: 0 };
}

function sanitizeStock(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseFiniteNumber(value);
  return parsed === null ? 0 : Math.max(0, Math.floor(parsed));
}

function parseRequiredFulfillmentType(value) {
  return value === 'delivery' || value === 'onsite' || value === 'pickup' ? value : null;
}

function normalizeShopProductPayload(value) {
  const product = asRecord(value);
  const fulfillmentTypeInput = parseRequiredFulfillmentType(product.fulfillmentType);
  const fulfillmentType = fulfillmentTypeInput || 'delivery';
  const fulfillmentLabel = sanitizeString(product.fulfillmentLabel);
  const unitLabel = sanitizeString(product.unitLabel);
  const minQuantityInput = parseRequiredQuantity(product.minQuantity);
  const maxQuantityInput = parseRequiredQuantity(product.maxQuantity);
  const quantityConfigurationValid = minQuantityInput !== null
    && maxQuantityInput !== null
    && maxQuantityInput >= minQuantityInput;
  const minQuantity = minQuantityInput || DEFAULT_MIN_QUANTITY;
  const maxQuantity = quantityConfigurationValid ? maxQuantityInput : minQuantity;
  const priceInput = parseRequiredCurrency(product.price);
  const shippingFeeInput = parseRequiredCurrency(product.shippingFee);
  const stockInput = parseRequiredStock(product.stock);
  const price = priceInput === null ? 0 : priceInput;
  const shippingFee = shippingFeeInput === null ? 0 : shippingFeeInput;
  const id = sanitizeString(product.id);
  const name = sanitizeString(product.name);

  return {
    id,
    name,
    price,
    originalPrice: sanitizeNonNegativeNumber(product.originalPrice, price),
    imageUrl: sanitizeString(product.imageUrl),
    description: sanitizeString(product.description),
    tags: Array.isArray(product.tags)
      ? product.tags.map((tag) => sanitizeString(tag)).filter(Boolean)
      : [],
    category: sanitizeString(product.category) || 'general',
    fulfillmentType,
    fulfillmentLabel,
    unitLabel,
    alcoholic: product.alcoholic === true,
    abv: sanitizeNonNegativeNumber(product.abv),
    volumeMl: sanitizeNonNegativeNumber(product.volumeMl),
    shippingFee,
    minQuantity,
    maxQuantity,
    stock: stockInput.value,
    enabled: product.enabled === true
      && Boolean(id)
      && Boolean(name)
      && priceInput !== null
      && shippingFeeInput !== null
      && quantityConfigurationValid
      && stockInput.valid
      && fulfillmentTypeInput !== null
      && Boolean(fulfillmentLabel)
      && Boolean(unitLabel),
  };
}

function getShopQuantityBounds(product) {
  const minQuantity = sanitizeBoundedInteger(
    product && product.minQuantity,
    DEFAULT_MIN_QUANTITY,
    DEFAULT_MIN_QUANTITY,
    DEFAULT_MAX_QUANTITY,
  );
  const configuredMaxQuantity = sanitizeBoundedInteger(
    product && product.maxQuantity,
    DEFAULT_MAX_QUANTITY,
    minQuantity,
    DEFAULT_MAX_QUANTITY,
  );
  const stock = sanitizeStock(product && product.stock);
  const maxQuantity = stock === null
    ? configuredMaxQuantity
    : Math.min(configuredMaxQuantity, stock);
  return {
    minQuantity,
    maxQuantity,
    canPurchase: Boolean(product && product.enabled === true && maxQuantity >= minQuantity),
  };
}

function clampShopQuantity(product, value) {
  const bounds = getShopQuantityBounds(product);
  const parsed = parseFiniteNumber(value);
  const quantity = parsed === null ? bounds.minQuantity : Math.floor(parsed);
  if (!bounds.canPurchase) return bounds.minQuantity;
  return Math.max(bounds.minQuantity, Math.min(bounds.maxQuantity, quantity));
}

function getShopProductQuantityIssue(product, quantity) {
  if (!product || product.enabled !== true) return '该商品已下架';
  const minQuantity = sanitizeBoundedInteger(
    product.minQuantity,
    DEFAULT_MIN_QUANTITY,
    DEFAULT_MIN_QUANTITY,
    DEFAULT_MAX_QUANTITY,
  );
  const maxQuantity = sanitizeBoundedInteger(
    product.maxQuantity,
    DEFAULT_MAX_QUANTITY,
    minQuantity,
    DEFAULT_MAX_QUANTITY,
  );
  if (!Number.isInteger(quantity) || quantity < minQuantity || quantity > maxQuantity) {
    return `购买数量需在 ${minQuantity}-${maxQuantity} 之间`;
  }
  const stock = sanitizeStock(product.stock);
  if (stock !== null && quantity > stock) return '商品库存不足';
  return '';
}

function calculateShopOrderPricing(product, quantity) {
  const unitPrice = Math.round(sanitizeNonNegativeNumber(product && product.price) * 100);
  const shippingFee = Math.round(sanitizeNonNegativeNumber(product && product.shippingFee) * 100);
  const subtotal = unitPrice * quantity;
  const amount = subtotal + shippingFee;
  if (
    !Number.isInteger(quantity)
    || quantity <= 0
    || ![unitPrice, shippingFee, subtotal, amount].every((item) => Number.isSafeInteger(item) && item >= 0)
  ) {
    throw new Error('订单金额异常');
  }
  return { amount, shippingFee, subtotal, unitPrice };
}

module.exports = {
  calculateShopOrderPricing,
  clampShopQuantity,
  getShopProductQuantityIssue,
  getShopQuantityBounds,
  normalizeShopProductPayload,
};
