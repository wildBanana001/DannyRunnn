import type { Product } from '@/types/shop';

// 商城商品占位素材基址（BFF 远程静态目录）
// 图片可能尚未上传，页面侧需对 <Image> 加载失败做降级处理
const SHOP_ASSET_BASE = 'https://worker-house-bff-251082-7-1426048919.sh.run.tcloudbase.com/static/images/shop';

/** 拼接商城素材远程 URL */
export const getShopAssetUrl = (fileName: string): string => `${SHOP_ASSET_BASE}/${fileName}`;

/** 社畜主题商品 Mock 数据（BFF /api/shop/products 不可用时兜底） */
export const mockProducts: Product[] = [
  {
    id: 'sp-001',
    name: '社畜续命手册',
    price: 39,
    originalPrice: 59,
    imageUrl: getShopAssetUrl('handbook.jpg'),
    description: '一本写给打工人的续命手册，收录 365 条摸鱼心法与解压涂鸦，翻开就能回一口血。',
    stock: 120,
    tags: ['社畜好物', '解压'],
    badge: 'HOT',
  },
  {
    id: 'sp-002',
    name: '摸鱼帆布包',
    price: 68,
    originalPrice: 88,
    imageUrl: getShopAssetUrl('canvas-bag.jpg'),
    description: '加厚帆布 + 手绘涂鸦印花，装得下电脑也装得下你逃离工位的心，通勤摸鱼两不误。',
    stock: 80,
    tags: ['通勤', '限量'],
    badge: 'NEW',
  },
  {
    id: 'sp-003',
    name: '打工人徽章套装',
    price: 29,
    imageUrl: getShopAssetUrl('badge-set.jpg'),
    description: '6 枚一套的金属徽章，「今天也不想上班」「已读乱回」随心别，让工牌带一点点态度。',
    stock: 200,
    tags: ['周边', '徽章'],
    badge: 'HOT',
  },
  {
    id: 'sp-004',
    name: '周末不上班马克杯',
    price: 58,
    originalPrice: 78,
    imageUrl: getShopAssetUrl('mug.jpg'),
    description: '陶瓷马克杯 400ml，杯身「Weekend Mode ON」遇热水会显字，摸鱼时的一点小确幸。',
    stock: 60,
    tags: ['杯子', '治愈'],
  },
  {
    id: 'sp-005',
    name: '社畜贴纸包',
    price: 19,
    imageUrl: getShopAssetUrl('sticker-pack.jpg'),
    description: '30 张防水手账贴纸，涂鸦风表情包全收录，贴电脑、贴水杯、贴日程本都很上头。',
    stock: 300,
    tags: ['贴纸', '手账'],
    badge: 'NEW',
  },
  {
    id: 'sp-006',
    name: '周边盲盒',
    price: 99,
    originalPrice: 129,
    imageUrl: getShopAssetUrl('blind-box.jpg'),
    description: '随机 3-5 件社畜快乐屋周边，隐藏款概率 1/12，拆开的瞬间就是打工人的多巴胺。',
    stock: 45,
    tags: ['盲盒', '惊喜'],
    badge: 'HOT',
  },
];

/** 按 id 查找 Mock 商品 */
export const findMockProduct = (id: string): Product | undefined =>
  mockProducts.find((item) => item.id === id);
