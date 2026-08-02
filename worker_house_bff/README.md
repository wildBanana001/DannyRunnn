# worker_house_bff

`worker_house_bff` 是给 `worker_house_admin` 管理后台与 `worker_house` 小程序共用的 Node Express BFF。当前仓库已经调整为“微信云托管就绪”状态：既支持本地 `mock`、传统 `wechat` 云开发调用，也支持部署到微信云托管后通过 `wx.cloud.callContainer` 直接访问。

## 技术栈

- Node.js 18+
- Express 4
- TypeScript
- axios
- cors
- dotenv

## 三种运行模式

### 1. `mock` 模式（默认）

适合本地联调、演示和未完成微信开放平台配置时使用。

- 不依赖微信云开发服务端调用权限
- 使用内存数据库模拟 `poster / activity / post / site_config / admin_auth`
- 微信身份中间件会自动注入 `mock_openid_001`
- 默认账号：`admin / admin123`
- 重启服务后数据会重置

### 2. `wechat` 模式

适合继续走微信云开发云函数数据链路。

BFF 会先通过微信开放平台接口获取 `access_token`，再调用：

`POST https://api.weixin.qq.com/tcb/invokecloudfunction?access_token=xxx&env=<envId>&name=<fnName>`

需要配置：

- `CLOUD_APP_ID`
- `CLOUD_APP_SECRET`
- `CLOUD_ENV_ID`

### 3. `cloudrun` 模式

适合直接部署到微信云托管 CloudRun。

- 通过 `X-WX-OPENID / X-WX-UNIONID / X-WX-APPID / X-WX-SOURCE / X-WX-FROM-OPENID` 读取微信自动注入身份
- `GET /health` 是容器存活检查；`GET /api/health` 反映业务配置是否就绪
- 商城订单和活动报名支付单共用微信云托管内置 MySQL，并通过 `kind` 字段隔离；不依赖 CloudBase 文档库或 `CLOUDBASE_APIKEY`
- `ALLOW_EPHEMERAL_CLOUDRUN_DATA=true` 只用于临时联调，商城与活动支付均不依赖该开关

## 环境变量

参考 `.env.example`：

```bash
MODE=mock
CLOUD_ENV_ID=your-cloud-env-id
CLOUD_APP_ID=your-wechat-app-id
CLOUD_APP_SECRET=your-wechat-app-secret
ADMIN_TOKEN=mock-admin-token
ADMIN_OPENID_WHITELIST=
CLOUD_ADMIN_SERVICE_TOKEN=
ALLOW_EPHEMERAL_CLOUDRUN_DATA=false
SHOP_ORDER_STORAGE=mysql
MYSQL_ADDRESS=内网地址:3306
MYSQL_USERNAME=
MYSQL_PASSWORD=
MYSQL_DATABASE=worker_house
MYSQL_CONNECTION_LIMIT=5
MYSQL_AUTO_MIGRATE=true
PORT=4000
```

说明：

- `MODE`：`mock`、`wechat` 或 `cloudrun`，默认 `mock`
- `CLOUD_MODE`：兼容旧配置的别名，未设置 `MODE` 时仍可继续使用
- `ADMIN_TOKEN`：管理端固定令牌，用于后台写接口鉴权
- `CLOUD_ADMIN_SERVICE_TOKEN`：BFF 调用管理云函数的独立高强度 Secret；生产环境必须在 BFF 与对应云函数中配置同一个值，禁止提交到 Git
- `ALLOW_EPHEMERAL_CLOUDRUN_DATA`：仅允许云托管联调时使用临时文件存储，默认 `false`
- `ENABLE_SHOP`：请在云托管控制台单独维护的 BFF 服务级商城/活动支付开关；仓库的容器清单不声明该变量，避免自动部署覆盖控制台设置。当前鸡尾酒为不限库存、现点现做；有限名额活动通过 MySQL 行锁与事务原子占位。
- `SHOP_ORDER_STORAGE`：云托管默认 `mysql`；`file` 只用于本地或临时联调。已确认旧库无真实订单后，线上遗留值 `cloudbase` 会临时兼容为 `mysql` 并输出警告；仍应从云托管服务变量中删除该旧值
- `MYSQL_ADDRESS / MYSQL_USERNAME / MYSQL_PASSWORD`：微信云托管 MySQL 的内网地址、用户名和密码；密码只放服务 Secret，禁止提交到 Git。也支持 `DB_HOST / DB_PORT / DB_USER / DB_PASSWORD` 或完整 `CONNECTION_URI`
- `MYSQL_DATABASE`：数据库名，默认 `worker_house`
- `MYSQL_CONNECTION_LIMIT`：单实例连接池上限，默认 `5`；当前最多 5 个 BFF 实例，数据库至少需允许约 25 条业务连接
- `MYSQL_AUTO_MIGRATE`：是否由 BFF 自动执行幂等建表。首次发布及现有云托管服务升级建议保持 `true`，确认表结构就绪后可按需关闭
- `PORT`：本地运行端口，默认 `4000`

### 微信支付 APIv3 配置

商城和收费活动报名统一采用“小程序 JSAPI 下单 → `Taro.requestPayment` → 服务端查单/支付通知确认”的流程。生产环境还需配置：

```bash
WECHAT_APP_ID=wx06f0bff0bed0dc80
WECHAT_PAY_MCH_ID=
WECHAT_PAY_SERIAL_NO=
WECHAT_PAY_PRIVATE_KEY=
WECHAT_PAY_API_KEY_V3=
WECHAT_PAY_NOTIFY_URL=https://你的公网域名/api/shop/orders/notify
WECHAT_PAY_PUBLIC_KEY=
WECHAT_PAY_PUBLIC_KEY_ID=
```

- `WECHAT_PAY_SERIAL_NO` 是商户 API 证书序列号。
- `WECHAT_PAY_PRIVATE_KEY` 支持原始 PEM（换行写成 `\n`）或 base64 编码的 PEM，禁止提交到 Git。
- `WECHAT_PAY_API_KEY_V3` 必须是 32 字节，只用于解密支付通知。
- `WECHAT_PAY_PUBLIC_KEY / ID` 推荐使用商户平台下载的微信支付公钥及其 `PUB_KEY_ID_*`。
- `WECHAT_PAY_NOTIFY_URL` 必须是微信支付可访问的 HTTPS 地址，并保留原始请求体和 `Wechatpay-*` 请求头。
- BFF 会校验上述配置格式；使用微信支付公钥或平台证书时，请求会携带对应的 `Wechatpay-Serial`，应答和通知只接受同一公钥 ID / 证书序列号的签名。

安全规则：

- `MODE=mock` 始终模拟支付，不会因为本机误配证书而发起真实扣款。
- 当前联调版本只在微信小程序中允许发起支付；商城 6 款鸡尾酒与 `act-001`、`act-002` 两场活动均使用 ¥0.01 真实支付测试价，联调完成后需恢复正式售价。
- 用户身份与真实支付只接受云托管注入的微信身份，并校验 `X-WX-APPID`；传统 `wechat` BFF 模式在接入服务端签名会话前会返回 `503`，不会信任客户端自报的 OpenID。
- 非 `mock` 模式缺少任一支付配置时，收费订单返回 `503`；价格为 0 的活动仍可直接完成报名。
- 前端支付成功只代表收银台返回成功；订单必须以后端主动查单或验签后的支付通知为准。
- 回调会校验签名时间、微信支付公钥 ID、AppID、商户号、订单号、金额和币种，并按通知 ID 幂等处理。
- `ENABLE_SHOP` 由云托管控制台管理。支付配置与 `/api/shop/readiness` 验证通过后可设置为 `true`；自动部署不会覆盖该值。
- 首次开启该变量前，先等待新 BFF 版本切换到 100% 流量，避免新旧实例并存期间接收支付订单。
- 生产商城和活动报名必须使用 `SHOP_ORDER_STORAGE=mysql`；商城还需按照交易类小程序规范接入发货管理。

## 本地启动

```bash
npm install
npm run dev
```

生产构建：

```bash
npm test
npm run build
npm run start
```

图片迁移脚本：

```bash
npm run migrate-images
```

默认监听 `http://localhost:4000`。

## 健康检查

- `GET /health`：只检查 Node 进程是否存活，正常时返回 `200`
- `GET /api/health`：检查业务运行配置；云托管未接入持久化数据源时返回 `503 configuration_required`
- `GET /api/shop/readiness`：检查商城/活动支付配置与订单库；不会调用微信支付或产生扣款
- `POST /api/shop/readiness/verify`：需管理端令牌，调用微信支付官方安全回显接口验证双向签名；不会创建交易

活动报名支付接口：

- `POST /api/shop/activity-registrations/pay`：按服务端活动价格创建报名支付单
- `GET /api/shop/activity-registrations/mine`：读取当前用户的报名记录
- `GET /api/shop/activity-registrations/:id`：查单并返回服务端确认后的报名状态
- `POST /api/shop/activity-registrations/:id/retry`：继续支付未过期的报名单
- 支付通知仍统一使用 `POST /api/shop/orders/notify`；旧的直接报名接口在非 `mock` 模式返回 `410`，不可绕过支付

返回示例：

```json
{
  "status": "configuration_required",
  "mode": "cloudrun",
  "persistence": "mysql-orders+bundled-content",
  "shop": {
    "enabled": false,
    "payment": "configuration_required",
    "keyMode": "unknown",
    "orderStorage": "mysql"
  },
  "timestamp": 1760000000000
}
```

## 路由概览

### 管理端接口

- `POST /api/auth/login`
- `GET /api/auth/profile`
- `POST /api/auth/logout`
- `POST /api/posters`
- `PUT /api/posters/:id`
- `DELETE /api/posters/:id`
- `PUT /api/posters/reorder`
- `POST /api/activities`
- `PUT /api/activities/:id`
- `DELETE /api/activities/:id`
- `POST /api/admin/upload`
- `POST /api/admin/upload/batch`
- `DELETE /api/posts/:id`
- `PATCH /api/posts/:id/pin`
- `PUT /api/site/config`

以上接口需要携带：

- `Authorization: Bearer <token>`
- `x-admin-token: <token>`

### 小程序可直接调用的接口

- `GET /api/posters`
- `GET /api/posters/:id`
- `GET /api/activities`
- `GET /api/activities/:id`
- `POST /api/activities/:id/signup`
- `GET /api/posts`
- `GET /api/posts/:id`
- `POST /api/posts`
- `POST /api/posts/:id/comments`
- `POST /api/posts/:id/like`
- `GET /api/site/config`

其中以下接口会读取微信身份中间件：

- `POST /api/activities/:id/signup`
- `POST /api/posts`
- `POST /api/posts/:id/comments`
- `POST /api/posts/:id/like`

行为规则：

- `mock` 模式：自动注入 `mock_openid_001`
- `wechat` 模式：保留原有逻辑，不强制校验微信 Header
- `cloudrun` 模式：若缺少 `X-WX-OPENID`，返回 `401`

## 小程序如何接入 BFF / CloudRun

### 走公网 BFF（`TARO_APP_API_MODE=bff`）

在 `worker_house/.env` 中配置：

```bash
TARO_APP_API_MODE=bff
TARO_APP_BFF_BASE_URL=https://your-bff-domain
```

### 走微信云托管（`TARO_APP_API_MODE=cloudrun`）

支付链路的云环境与服务名已固定在 `worker_house/src/constants/runtime.ts`。如果其他通用数据链路也需要切换到云托管，只需配置 `TARO_APP_API_MODE=cloudrun`。

小程序会通过 `wx.cloud.callContainer` 调用云托管服务，无需额外域名与小程序侧鉴权。

## 云托管部署指南

### 需要准备的文件

- `Dockerfile`：多阶段构建 Node 运行镜像
- `.dockerignore`：排除 `node_modules / dist / .env* / logs / .git`
- `container.config.json`：声明容器端口、实例伸缩策略、环境变量等元数据

### 开通与部署步骤

1. 在微信公众平台中开通云托管，拿到环境 ID。
2. 在同一个微信云托管环境的“ MySQL ”页面创建 `worker_house` 数据库，并启用供云托管访问的内网连接。
3. 保持 `container.config.json` 中的 `MODE=cloudrun`、`SHOP_ORDER_STORAGE=mysql`；不要把 `ALLOW_EPHEMERAL_CLOUDRUN_DATA` 改成 `true` 用于生产。
4. 在 BFF 服务变量中配置 MySQL 内网连接信息；无需打开独立 CloudBase 控制台，也无需配置 `CLOUDBASE_APIKEY`。
5. 推荐在服务更新页选择“Git 仓库部署”，绑定 GitHub 仓库 `wildBanana001/DannyRunnn`。
6. 选择分支 `main`，目标目录填 `worker_house_bff`，Dockerfile 填 `Dockerfile`，端口填 `8080`。
7. 开启“自动部署”并选择 push / PR 合并到 `main` 后触发；GitHub Actions 会同时执行 TypeScript 编译、HTTP 冒烟测试和 Docker 构建校验。
8. 部署完成后，通过 `wx.cloud.callContainer` 或公网访问地址验证：
   - `GET /health`
   - `GET /api/health`
   - 微信身份 Header 自动注入的受保护接口

更详细的 runbook 见：`scripts/deploy-cloudrun.md`。

## 从 `mock` 切换到 `cloudrun` 需要做的事

1. 在微信公众平台开通云托管并创建服务
2. 获取环境 ID（例如 `prod-xxxx`）
3. 确认 `worker_house/src/constants/runtime.ts` 中的支付模式为 `cloudrun`；商城和活动报名支付会一起启用，其他模块可继续保持 `TARO_APP_API_MODE=mock`
4. 确认 `/api/shop/readiness` 返回支付配置与 MySQL 订单库均为 `ready=true`
5. 将 `worker_house_bff` 按 `Dockerfile + container.config.json` 部署到同一云托管环境
6. 重启服务并验证 `/api/health` 与小程序写接口

## 部署建议

### 本地 / 沙箱长期运行

- `npm run build`
- `MODE=mock PORT=4000 npm run start`
- 通过 Aime 的端口暴露能力获取公网访问地址

### 微信云托管

- 推荐直接使用仓库根目录的 `Dockerfile` 构建镜像
- 容器默认监听非特权端口 `8080`，以便使用非 root 用户安全运行
- `minNum=0`，空闲时可自动缩容到 0 以节省成本

### 传统云服务器 / 容器

适合长期稳定运行，建议配合 PM2、systemd 或容器编排管理进程。

## 已知限制

- 商城订单与活动报名已支持云托管 MySQL 持久化；其余仍使用文件存储的 BFF 写接口会继续被默认安全门禁阻止
- `wechat` 模式下，BFF 仍依赖 `CLOUD_APP_ID / CLOUD_APP_SECRET / CLOUD_ENV_ID`
- MySQL 首次创建和表初始化由云托管流水线 SQL 或 `MYSQL_AUTO_MIGRATE=true` 完成
