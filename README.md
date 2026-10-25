# DannyRunnn · worker_house monorepo

面向 worker_house 小程序 / BFF 的 monorepo 代码仓。

> 注：旧 Web 管理后台已移除；小程序内的管理员工作台沿用 OpenID 白名单，提供活动管理、推文导入和订单核销。正式小程序只通过 BFF 获取业务数据；仓库内的前端 mock 仅供显式 `mock` 开发构建使用，并由生产构建 alias 与产物扫描双重隔离。如需查阅历史代码，可回溯到标签 `refactor/before-p0`。

## 子项目

| 目录 | 说明 | 技术栈 |
|---|---|---|
| `worker_house/` | 微信小程序用户端与管理员工作台 | Taro 4.1.9 + React 18 + TypeScript |
| `worker_house_bff/` | 微信云托管后端（BFF） | Express + TypeScript，部署环境 `prod-d9g991lo4dba5a4da` |

小程序底部包含首页、活动、商城和“我的”四个 Tab；留言墙是由服务端开关控制的内容页。商城本地使用安全的模拟支付，生产支付配置见 `worker_house_bff/README.md`。

项目目录、页面分包、接口链路及数据归属详见 `worker_house/docs/architecture-and-data-sources.md`。

个人中心设置页包含“注销账号与删除数据”：注销前保护待支付、未履约订单与未使用权益，注销后删除用户资料、地址、报名及社区内容，并仅对必须保留的真实支付凭证执行去标识化留存。帖子、评论及其云存储文件由 BFF 直接清理，随 `origin/main` 的云托管版本一起发布。

## 小程序管理后台

白名单管理员在「我的 → 管理后台」进入活动工作台，保留「订单核销」入口。身份直接由云托管注入的 OpenID 校验，不依赖昵称/头像资料登录；接口仍逐次校验 `ADMIN_OPENID_WHITELIST`。

创建活动只需粘贴复制出来的推文正文，支持最多 20000 字。正文在服务端按明确的标题、活动时间、地点、费用、人数等字段提取；不需要额外 AI 服务。导入只生成编辑草稿，不会直接上架。缺年份、多档价格等不明确的信息需要手动补齐。复制的正文不含图片，可上传封面或填写图片链接。

编辑器支持图片、时间、单价、名额、地点、正文、退款说明及内容预览。未完成的新草稿暂存在当前设备；填齐必填项后可保存为未发布活动，或确认发布到现有 MySQL 活动目录。工作台支持搜索、分页、编辑和下架；下架保留历史报名及订单。

本地页面联调使用 `TARO_APP_API_MODE=bff` 和本地 `TARO_APP_BFF_BASE_URL`，配合 `MODE=mock` 的 BFF。生产使用 `cloudrun`；需同时发布新版 BFF 和小程序。未新增数据库表或管理员账号体系。

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
