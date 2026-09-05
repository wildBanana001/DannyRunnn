# DannyRunnn · worker_house monorepo

面向 worker_house 小程序 / BFF 的 monorepo 代码仓。

> 注：旧 Web 管理后台和小程序原生管理分包均已移除。正式小程序只通过 BFF 获取业务数据；仓库内的前端 mock 仅供显式 `mock` 开发构建使用，并由生产构建 alias 与产物扫描双重隔离。如需查阅历史代码，可回溯到标签 `refactor/before-p0`。

## 子项目

| 目录 | 说明 | 技术栈 |
|---|---|---|
| `worker_house/` | 微信小程序用户端（不包含管理与数据配置页面） | Taro 4.1.9 + React 18 + TypeScript |
| `worker_house_bff/` | 微信云托管后端（BFF） | Express + TypeScript，部署环境 `prod-d9g991lo4dba5a4da` |

小程序底部包含首页、活动、商城和“我的”四个 Tab；留言墙是由服务端开关控制的内容页。商城本地使用安全的模拟支付，生产支付配置见 `worker_house_bff/README.md`。

项目目录、页面分包、接口链路及数据归属详见 `worker_house/docs/architecture-and-data-sources.md`。

个人中心设置页包含“注销账号与删除数据”：注销前保护待支付、未履约订单与未使用权益，注销后删除用户资料、地址、报名及社区内容，并仅对必须保留的真实支付凭证执行去标识化留存。帖子、评论及其云存储文件由 BFF 直接清理，随 `origin/main` 的云托管版本一起发布。

## 快速开始

```bash
# 小程序：本地 mock 联调
cd worker_house
npm ci
TARO_APP_API_MODE=mock npm run dev:weapp

# 小程序：CloudRun 正式构建
TARO_APP_API_MODE=cloudrun \
TARO_APP_CLOUD_ENV_ID=prod-d9g991lo4dba5a4da \
TARO_APP_CLOUDRUN_SERVICE=worker-house-bff \
npm run build:weapp
npm run verify:production-bundle

# BFF
cd worker_house_bff
npm ci
npm test
npm start
```

## ⚠️ 重要说明

### 环境变量
- 各子项目需自行基于 `.env.example` 复制出 `.env.local`（仓库未提交）。
- 小程序上传微信的 `.keys/private.*.key` 私钥文件**未提交**，由微信公众平台下载后本地放置。

### 本地模拟凭据
- `worker_house_bff/src/mock/seed.ts` 的 `admin / admin123` 只用于本地 `MODE=mock` 联调。
- 云函数管理端不再内置默认账号或固定管理令牌；生产账号需在 `admins` 集合中配置 `username / passwordHash / passwordSalt / token`，BFF 与云函数之间另用未入库的 `CLOUD_ADMIN_SERVICE_TOKEN`。
- `_seed` 默认不可执行且不得常驻生产环境，它会清空并重建业务集合。

### 主题 & 规范
- 主色：`#E60000`
- 副色：`#FFE600`
- 展示字体：鸿雷拙书简体（`worker_house/src/assets/fonts/honglei-zhuoshu.woff2`，子集化 WOFF2 ~350 KB）
- 字体托管由 BFF `public/fonts/` 暴露为 `/static/fonts/honglei-zhuoshu.woff2`
- 小程序侧通过 `TARO_APP_BFF_BASE_URL` 环境变量拼接字体 URL，`wx.loadFontFace` 动态加载
