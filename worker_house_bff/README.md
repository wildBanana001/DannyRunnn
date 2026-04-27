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
- `GET /api/health` 可作为容器健康检查端点
- 当前阶段仍复用 `mock` 的内存存储，方便先把容器链路跑通
- 后续真实部署后，再接入 `@cloudbase/node-sdk` / 云开发数据库（本轮未接）

## 环境变量

参考 `.env.example`：

```bash
MODE=mock
CLOUD_ENV_ID=your-cloud-env-id
CLOUD_APP_ID=your-wechat-app-id
CLOUD_APP_SECRET=your-wechat-app-secret
ADMIN_TOKEN=mock-admin-token
PORT=4000
```

说明：

- `MODE`：`mock`、`wechat` 或 `cloudrun`，默认 `mock`
- `CLOUD_MODE`：兼容旧配置的别名，未设置 `MODE` 时仍可继续使用
- `ADMIN_TOKEN`：管理端固定令牌，用于后台写接口鉴权
- `PORT`：本地运行端口，默认 `4000`

## 本地启动

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run start
```

图片迁移脚本：

```bash
npm run migrate-images
```

默认监听 `http://localhost:4000`。

## 健康检查

- `GET /health`
- `GET /api/health`

返回示例：

```json
{
  "status": "ok",
  "mode": "cloudrun",
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

在 `worker_house/.env` 中配置：

```bash
TARO_APP_API_MODE=cloudrun
TARO_APP_CLOUDRUN_ENV=prod-xxxx
TARO_APP_CLOUDRUN_SERVICE=worker-house-bff
```

小程序会通过 `wx.cloud.callContainer` 调用云托管服务，无需额外域名与小程序侧鉴权。

## 云托管部署指南

### 需要准备的文件

- `Dockerfile`：多阶段构建 Node 运行镜像
- `.dockerignore`：排除 `node_modules / dist / .env* / logs / .git`
- `container.config.json`：声明容器端口、实例伸缩策略、环境变量等元数据

### 开通与部署步骤

1. 在微信公众平台中开通云托管，拿到环境 ID。
2. 保持 `container.config.json` 中的 `MODE=cloudrun`。
3. 通过控制台“上传代码包”或 `@cloudbase/cli` 部署当前目录。
4. 部署完成后，通过 `wx.cloud.callContainer` 或公网访问地址验证：
   - `GET /api/health`
   - 微信身份 Header 自动注入的受保护接口

更详细的 runbook 见：`scripts/deploy-cloudrun.md`。

## 从 `mock` 切换到 `cloudrun` 需要做的事

1. 在微信公众平台开通云托管并创建服务
2. 获取环境 ID（例如 `prod-xxxx`）
3. 将 `worker_house` 小程序环境变量切到 `TARO_APP_API_MODE=cloudrun`
4. 将 `worker_house_bff` 按 `Dockerfile + container.config.json` 部署到同一云托管环境
5. 重启服务并验证 `/api/health` 与小程序写接口

## 部署建议

### 本地 / 沙箱长期运行

- `npm run build`
- `MODE=mock PORT=4000 npm run start`
- 通过 Aime 的端口暴露能力获取公网访问地址

### 微信云托管

- 推荐直接使用仓库根目录的 `Dockerfile` 构建镜像
- 容器默认监听 `80`
- `minNum=0`，空闲时可自动缩容到 0 以节省成本

### 传统云服务器 / 容器

适合长期稳定运行，建议配合 PM2、systemd 或容器编排管理进程。

## 已知限制

- `mock` 与 `cloudrun` 模式当前都使用内存存储，服务重启后会恢复种子数据
- `wechat` 模式下，BFF 仍依赖 `CLOUD_APP_ID / CLOUD_APP_SECRET / CLOUD_ENV_ID`
- 云托管环境下的云开发数据库直连能力已预留改造位，本轮未启用
