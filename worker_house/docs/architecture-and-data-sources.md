# 小程序架构与数据归属

本文描述 `worker_house` 正式微信小程序的运行结构，以及业务数据的唯一来源。显式 `TARO_APP_API_MODE=mock` 的本地开发行为不代表生产链路。

## 运行链路

```text
Taro 页面 / 组件
        │
        ▼
services（参数归一化、会话校验、错误处理）
        │
        ▼
request（bff / wx.cloud.callContainer）
        │
        ▼
worker_house_bff（鉴权、能力开关、服务端核价）
        ├── MySQL：活动、商品、订单、报名支付单
        ├── CloudBase：海报、站点内容、留言与评论
        └── 微信接口：身份、支付、订单履约上报
```

客户端不拥有活动价格、商品价格、运费、库存限制、报名名额或支付状态的最终解释权；创建和重试订单时均由 BFF 重新读取服务端目录并核验。

## 目录结构

```text
worker_house/
├── config/                  Taro 构建配置、API 模式校验、生产 mock 隔离
├── scripts/                 CI 上传、生产包业务种子扫描
├── src/
│   ├── pages/               主包页面
│   ├── pages/content/       内容分包：活动详情、报名详情、留言等
│   ├── pages/shop/          商城分包：商品、确认单、订单、支付结果
│   ├── components/          通用展示与交互组件
│   ├── services/            BFF 契约、支付/会员/商城服务
│   ├── cloud/               活动、海报、留言等 API 聚合层
│   ├── shared/              跨页面共享的站点能力状态
│   ├── store/               登录用户等客户端状态
│   ├── data/                仅显式 mock 构建使用的开发 fixture
│   │   └── remote-safe/     非 mock 构建替换模块，不含业务种子
│   ├── constants/           公开运行参数和本地能力总开关
│   └── assets/              通用 UI 图片、图标和字体
└── tests/                   状态、构建模式、契约和隔离测试

worker_house_bff/
├── src/routes/              公开、用户、管理和支付路由
├── src/services/            微信支付、履约、账号删除等领域服务
├── src/data/                目录与订单模型、MySQL 访问、本地 mock seed
├── src/mock/                仅 MODE=mock 的 BFF fixture
├── sql/                     幂等 MySQL 建表/迁移脚本
└── public/                  BFF 对外提供的活动/商品图片和字体
```

## 页面与分包

- Tab：首页、活动、商城、我的。
- 主包还包含留言墙、登录/报名入口、个人资料、地址、设置等轻量页面。
- `pages/content` 分包承载活动详情、报名记录、内容详情和管理员履约页。
- `pages/shop` 分包承载商品详情、订单确认、我的订单、订单详情和支付结果。

## 业务数据矩阵

| 数据 | 小程序读取 | BFF 生产来源 | 本地文件的角色 |
|---|---|---|---|
| 活动目录、状态、价格、名额、图片 | `/api/activities` | MySQL `worker_house_activities` | `activities.store.json` 仅首次种库和本地 mock |
| 商品目录、价格、运费、数量限制、库存配置 | `/api/shop/products` | MySQL `worker_house_shop_products` | `shop.store.json` 仅首次种库和本地 mock |
| 商城订单、活动报名支付单 | `/api/shop/**` | MySQL `worker_house_orders`；`pending/paid` 订单占用库存或名额 | 前端不保存可作为支付依据的订单配置 |
| 海报 | `/api/posters` | BFF 调用 `poster` 云函数 / CloudBase | 前端 `data/posters.ts` 仅 mock 构建 |
| 首页共享配置 | `/api/site-config` | BFF 站点配置快照 + 服务变量开关 | 远端失败不得回退并缓存前端业务文案 |
| 起源页旧站点内容 | `/api/site/config` | BFF 调用 `site_config` 云函数 / CloudBase | 前端失败时展示空态，不合并 `data/site.ts` |
| 留言、评论 | `/api/posts` | BFF 直连 CloudBase | `data/posts.ts` 仅 mock 构建 |
| 留言墙开关 | `/api/site-config` | BFF 服务变量 | 前端默认关闭并等待接口结果 |
| 次卡 | 用户侧能力关闭 | 购买接口固定返回不可用 | mock 数据不会进入生产包 |

## 生产保护

1. 正式微信小程序构建必须显式使用 `bff` 或 `cloudrun`，禁止缺省或使用 `mock`。
2. `cloudrun` 构建必须提供公开的环境 ID 和服务名；支付密钥只允许存在于 BFF 服务 Secret。
3. Webpack 将开发 fixture 替换为 `src/data/remote-safe` 空实现，远端失败展示错误/空态，不读取本地活动、海报、会员或留言数据。
4. CI 在构建后执行 `npm run verify:production-bundle`，发现活动、海报、留言、会员、管理员核销或 mock 身份种子即失败。
5. BFF 对活动、商品目录和海报发布状态执行严格归一化；异常、缺字段或非法金额记录一律 fail-closed。
6. 支付金额按服务端单价、数量和单笔运费计算，客户端金额只用于一致性检查，不能覆盖服务端结果。
7. 有限库存商品在 MySQL 事务中按商品串行预占；关闭或失败订单释放库存，重复请求保持幂等，超卖返回 `409`。
8. 活动下单在同一事务内锁定目录和名额，重新核对版本、上下架、价格与容量；迟到支付也必须重新占用名额。

## 尚未完成的基础设施

- 商品目录已有 MySQL 真源和公开读取接口，但仓库目前没有独立的商品管理 CRUD；上架变更仍需受控数据库变更。
- 用户资料和地址仍是遗留文件型能力，CloudRun 默认安全关闭。活动报名已可直接提交当次资料快照，不再被资料服务阻断；如要开放资料簿或配送商品，应先迁移到 MySQL。
- 首页共享配置仍由 BFF 文件型配置快照提供，完整旧站点内容与海报仍依赖 CloudBase 云函数；这些尚未与活动/商品目录统一到 MySQL。
- 生产发布前仍需在云托管控制台完成支付、MySQL、管理员 OpenID 与商城开关配置，并通过 `/api/shop/readiness` 验证。
- 活动/商品目录、订单并发、一分钱调价共三个真实 MySQL 集成测试需要独立测试库和 `MYSQL_TEST_URL`；本地 `npm test` 未配置时会跳过，BFF CI 的专用 `npm run test:mysql` 门禁会使用 MySQL 8 测试服务实际执行，禁止跳过。

首次迁移、验收、回滚和后续优先级见 [发布下一步清单](release-next-steps.md)。
