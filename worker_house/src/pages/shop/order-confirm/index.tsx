import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Input, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { Add, ArrowRight, Minus, Plus } from '@nutui/icons-react-taro';
import WxLoginModal from '@/components/WxLoginModal/WxLoginModal';
import ShopProductImage from '@/components/ShopProductImage';
import { usePaymentErrorDialog } from '@/hooks/usePaymentErrorDialog';
import { useViewportLayout } from '@/hooks/useViewportLayout';
import { fetchAddresses, type Address } from '@/services/address';
import {
  calculateShopOrderPricing,
  clampShopQuantity,
  createShopClientRequestId,
  confirmShopPayment,
  fetchShopProduct,
  getShopProductQuantityIssue,
  getShopQuantityBounds,
  isPaymentCancelled,
  launchShopPayment,
  startShopPayment,
  type ShopProduct,
} from '@/services/shop';
import { useUserStore } from '@/store/userStore';
import styles from './index.module.scss';

const ADDRESS_EVENT = 'shop:address-selected';
const EMPTY_PRICING = { amount: 0, shippingFee: 0, subtotal: 0, unitPrice: 0 };

const OrderConfirmPage: React.FC = () => {
  const router = useRouter();
  const productId = router.params.id || '';
  const initialQuantity = Math.max(1, Math.floor(Number(router.params.quantity) || 1));
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const clientRequestIdRef = useRef(createShopClientRequestId());
  const wasLoggedInRef = useRef(isLoggedIn);
  const viewportStyle = useViewportLayout();
  const { paymentErrorDialog, showPaymentError } = usePaymentErrorDialog();

  const loadData = useCallback(async () => {
    if (!productId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const nextProduct = await fetchShopProduct(productId);
      const addresses = nextProduct.fulfillmentType === 'delivery' && isLoggedIn
        ? await fetchAddresses()
        : [];
      setProduct(nextProduct);
      setQuantity((current) => clampShopQuantity(nextProduct, current));
      setAddress((current) => (
        nextProduct.fulfillmentType === 'delivery' && isLoggedIn
          ? (
          addresses.find((item) => item.id === current?.id)
          || addresses.find((item) => item.isDefault)
          || addresses[0]
          || null
          )
          : null
      ));
    } catch (loadError) {
      console.warn('[shop] load order confirmation failed', loadError);
      Taro.showToast({ title: '订单信息加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, productId]);

  useDidShow(() => {
    loadData();
  });

  useEffect(() => {
    const handleAddressSelected = (selected: Address) => setAddress(selected);
    Taro.eventCenter.on(ADDRESS_EVENT, handleAddressSelected);
    return () => {
      Taro.eventCenter.off(ADDRESS_EVENT, handleAddressSelected);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setAddress(null);
    }
    if (isLoggedIn && !wasLoggedInRef.current) {
      loadData();
    }
    wasLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn, loadData]);

  const pricing = product ? calculateShopOrderPricing(product, quantity) : EMPTY_PRICING;
  const quantityBounds = product
    ? getShopQuantityBounds(product)
    : { canPurchase: false, maxQuantity: 0, minQuantity: 1 };
  const quantityIssue = product ? getShopProductQuantityIssue(product, quantity) : '商品信息不存在';
  const totalAmount = pricing.amount;
  const requiresAddress = product?.fulfillmentType === 'delivery';
  const isFree = totalAmount === 0;

  const changeQuantity = (delta: number) => {
    if (paying || !product || !quantityBounds.canPurchase) return;
    setQuantity((current) => clampShopQuantity(product, current + delta));
  };

  const chooseAddress = () => {
    if (!requiresAddress) return;
    if (!isLoggedIn) {
      setShowLogin(true);
      return;
    }
    Taro.navigateTo({ url: address ? '/pages/my-addresses/index?select=1' : '/pages/address-edit/index' });
  };

  const handlePay = async () => {
    if (paying || !product) return;
    const currentQuantityIssue = getShopProductQuantityIssue(product, quantity);
    if (currentQuantityIssue) {
      Taro.showToast({ title: currentQuantityIssue, icon: 'none' });
      return;
    }
    if (!isLoggedIn) {
      setShowLogin(true);
      return;
    }
    if (requiresAddress && !address) {
      Taro.showToast({ title: '请先添加收货地址', icon: 'none' });
      return;
    }
    let outTradeNo = '';
    setPaying(true);
    try {
      Taro.showLoading({ title: isFree ? '正在领取…' : '正在创建订单…', mask: true });
      const session = await startShopPayment({
        clientRequestId: clientRequestIdRef.current,
        productId: product.id,
        quantity,
        remark,
        ...(requiresAddress && address ? { address } : {}),
      });
      outTradeNo = session.outTradeNo;
      Taro.hideLoading();

      if (
        session.productId !== product.id
        || session.amount !== pricing.amount
        || session.unitPrice !== pricing.unitPrice
        || session.shippingFee !== pricing.shippingFee
        || session.quantity !== quantity
      ) {
        await loadData();
        throw new Error('商品价格已更新，请核对后重新支付');
      }

      if (session.amount > 0) {
        await launchShopPayment(session);
      }

      Taro.showLoading({ title: isFree ? '正在确认领取…' : '正在确认支付…', mask: true });
      const order = await confirmShopPayment(session.outTradeNo);
      const status = order.status === 'paid' ? 'success' : 'pending';
      Taro.hideLoading();
      Taro.redirectTo({
        url: `/pages/shop/payment-result/index?status=${status}&orderId=${encodeURIComponent(session.outTradeNo)}`,
      });
    } catch (payError) {
      Taro.hideLoading();
      if (isPaymentCancelled(payError)) {
        if (outTradeNo) {
          Taro.redirectTo({
            url: `/pages/shop/payment-result/index?status=pending&orderId=${encodeURIComponent(outTradeNo)}`,
          });
        } else {
          Taro.showToast({ title: '已取消支付', icon: 'none' });
        }
      } else {
        console.warn('[shop] payment failed', payError);
        showPaymentError(payError, '支付发起失败，请稍后重试');
      }
    } finally {
      setPaying(false);
    }
  };

  if (loading && !product) {
    return <View className={styles.state} style={viewportStyle}><Text>正在核对订单…</Text></View>;
  }

  if (!product) {
    return <View className={styles.state} style={viewportStyle}><Text>商品信息不存在，请返回商城重新选择。</Text></View>;
  }

  return (
    <View className={styles.container} style={viewportStyle}>
      {requiresAddress ? (
        <View className={styles.section} onClick={chooseAddress}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>收货地址</Text>
            <View className={styles.changeAction}>
              <Text className={styles.changeText}>{address ? '更换' : '添加'}</Text>
              <ArrowRight className={styles.changeIcon} size="13" />
            </View>
          </View>
          {address ? (
            <View className={styles.addressCard}>
              <Text className={styles.addressName}>{address.name} · {address.phone}</Text>
              <Text className={styles.addressText}>{address.province} {address.city} {address.district} {address.detail}</Text>
            </View>
          ) : (
            <View className={styles.emptyAddress}>
              <Add className={styles.emptyAddressIcon} size="16" />
              <Text>{isLoggedIn ? '添加一个收货地址' : '登录后选择收货地址'}</Text>
            </View>
          )}
        </View>
      ) : (
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>领取方式</Text>
          <View className={styles.fulfillmentCard}>
            <View className={styles.fulfillmentBadge}><Text>店</Text></View>
            <View className={styles.fulfillmentContent}>
              <Text className={styles.fulfillmentTitle}>{product.fulfillmentLabel || '到店自取'}</Text>
              <Text className={styles.fulfillmentText}>无需填写收货地址，{isFree ? '领取' : '支付'}成功后到店出示订单</Text>
            </View>
          </View>
        </View>
      )}

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>商品清单</Text>
        <View className={styles.productRow}>
          <ShopProductImage
            className={styles.productThumb}
            src={product.imageUrl}
            mode="aspectFill"
          />
          <View className={styles.productInfo}>
            <Text className={styles.productName}>{product.name}</Text>
            <Text className={styles.productMeta}>¥{product.price.toFixed(2)} × {quantity} {product.unitLabel}</Text>
            <Text className={styles.quantityHint}>
              每单 {product.minQuantity}-{product.maxQuantity} {product.unitLabel}
              {product.stock === null ? '' : ` · 剩余 ${product.stock}`}
            </Text>
          </View>
          <View className={styles.quantityControl}>
            <View
              className={`${styles.quantityButton} ${paying || !quantityBounds.canPurchase || quantity <= quantityBounds.minQuantity ? styles.quantityButtonDisabled : ''}`}
              onClick={() => changeQuantity(-1)}
            ><Minus size="14" /></View>
            <Text className={styles.quantityValue}>{quantity}</Text>
            <View
              className={`${styles.quantityButton} ${paying || !quantityBounds.canPurchase || quantity >= quantityBounds.maxQuantity ? styles.quantityButtonDisabled : ''}`}
              onClick={() => changeQuantity(1)}
            ><Plus size="14" /></View>
          </View>
        </View>
        <View className={styles.pricingSummary}>
          <View className={styles.pricingRow}>
            <Text className={styles.pricingLabel}>商品小计</Text>
            <Text className={styles.pricingValue}>¥{(pricing.subtotal / 100).toFixed(2)}</Text>
          </View>
          <View className={styles.pricingRow}>
            <Text className={styles.pricingLabel}>配送费</Text>
            <Text className={styles.pricingValue}>
              {pricing.shippingFee > 0 ? `¥${(pricing.shippingFee / 100).toFixed(2)}` : '¥0.00'}
            </Text>
          </View>
        </View>
        <View className={styles.remarkRow}>
          <Text className={styles.remarkLabel}>订单备注</Text>
          <Input
            className={styles.remarkInput}
            maxlength={80}
            placeholder="选填，最多 80 字"
            value={remark}
            onInput={(event) => setRemark(event.detail.value)}
          />
        </View>
      </View>

      <View className={styles.paymentNotice}>
        <Text className={styles.paymentNoticeTitle}>{isFree ? '免费领取确认' : '微信支付安全确认'}</Text>
        <Text className={styles.paymentNoticeText}>
          {requiresAddress
            ? `${isFree ? '领取' : '支付'}成功后，系统会确认订单状态并按所选地址安排配送。`
            : `${isFree ? '领取' : '支付'}成功后，系统会确认订单状态；本订单为${product.fulfillmentLabel || '到店自取'}，不会安排配送。`}
        </Text>
      </View>

      <View className={styles.footer}>
        <View className={styles.total}>
          <Text className={styles.totalLabel}>合计</Text>
          <Text className={styles.totalValue}>{isFree ? '免费' : `¥${(totalAmount / 100).toFixed(2)}`}</Text>
        </View>
        <View className={`${styles.payBtn} ${paying || quantityIssue ? styles.payBtnDisabled : ''}`} onClick={handlePay}>
          <Text className={styles.payBtnText}>
            {quantityIssue ? '暂不可购买' : paying ? (isFree ? '领取中…' : '处理中…') : (isFree ? '免费领取' : '微信支付')}
          </Text>
        </View>
      </View>

      <WxLoginModal
        visible={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={() => setShowLogin(false)}
      />
      {paymentErrorDialog}
    </View>
  );
};

export default OrderConfirmPage;
