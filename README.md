# DannyRunnn · worker_house monorepo

面向 worker_house 小程序 / BFF 的 monorepo 代码仓。

> 注：旧 Web 管理后台 `worker_house_admin/` 已于重构中移除，管理能力已收敛到小程序原生管理分包 `pages/admin/*`。如需查阅历史代码，可回溯到标签 `refactor/before-p0`。

## 子项目

| 目录 | 说明 | 技术栈 |
|---|---|---|
| `worker_house/` | 微信小程序主端（C 端 + 原生管理分包 `pages/admin/*`） | Taro 4.1.9 + React 18 + TypeScript |
| `worker_house_bff/` | 微信云托管后端（BFF） | Express + TypeScript，部署环境 `prod-d9g991lo4dba5a4da` |

小程序包含首页、活动、商城、留言墙和个人中心五个主入口；商城本地使用安全的模拟支付，生产支付配置见 `worker_house_bff/README.md`。

个人中心设置页包含“注销账号与删除数据”：注销前保护待支付、未履约订单与未使用权益，注销后删除用户资料、地址、报名及社区内容，并仅对必须保留的真实支付凭证执行去标识化留存。部署时需同时更新 BFF 与 `post` 云函数。

## 快速开始

```bash
# 小程序
cd worker_house
npm install --legacy-peer-deps
npm run build:weapp

# BFF
cd worker_house_bff
npm install
npm run build && npm start
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
