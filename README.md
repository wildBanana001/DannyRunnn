# DannyRunnn · worker_house monorepo

面向 worker_house 小程序 / BFF / Admin 的 monorepo 代码仓。

## 子项目

| 目录 | 说明 | 技术栈 |
|---|---|---|
| `worker_house/` | 微信小程序主端（C 端 + 原生管理分包 `pages/admin/*`） | Taro 4.1.9 + React 18 + TypeScript |
| `worker_house_bff/` | 微信云托管后端（BFF） | Express + TypeScript，部署环境 `prod-d9g991lo4dba5a4da` |
| `worker_house_admin/` | 旧 Web 管理后台（**已弃用，仅作备份参考，严禁修改**） | React 18 + Vite + TypeScript + Ant Design 5 |

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

# Admin（已弃用）
cd worker_house_admin
npm install
npm run dev
```

## ⚠️ 重要说明

### 环境变量
- 各子项目需自行基于 `.env.example` 复制出 `.env.local`（仓库未提交）。
- 小程序上传微信的 `.keys/private.*.key` 私钥文件**未提交**，由微信公众平台下载后本地放置。

### 默认凭据（请务必在生产环境修改！）
- `worker_house/cloudfunctions/admin_auth/index.js` 默认 `admin / worker_house_2026`
- `worker_house_admin` Mock 默认 `admin / admin123`
- `worker_house_bff/src/mock/seed.ts` 种子数据默认密码为 `admin123`

### 主题 & 规范
- 主色：`#E60000`
- 副色：`#FFE600`
- 展示字体：鸿雷拙书简体（`worker_house/src/assets/fonts/honglei-zhuoshu.woff2`，子集化 WOFF2 ~350 KB）
- 字体托管由 BFF `public/fonts/` 暴露为 `/static/fonts/honglei-zhuoshu.woff2`
- 小程序侧通过 `TARO_APP_BFF_BASE_URL` 环境变量拼接字体 URL，`wx.loadFontFace` 动态加载
