# worker_house_admin

`worker_house_admin` 是为 `worker_house` 小程序配套设计与实现的一套后台管理系统前端项目，面向运营与管理员日常使用。当前交付为 **前端项目 + Mock 数据** 路线，已内置 MSW 模拟接口，后续可以平滑替换为真实后端服务。

## 功能概览

- 登录：账号密码登录、登录态持久化、路由守卫
- Dashboard：活动总数、进行中活动数、留言墙帖子总数、置顶帖子数、海报总数、启用海报数、最近 5 条活动
- 活动管理：列表查看、关键字搜索、状态筛选、新增、编辑、删除，封面/相册/场地图支持直接上传
- 海报管理：列表查看、详情图数量、启用切换、排序、新增、编辑、删除，支持封面图与详情图上传
- 留言墙管理：列表查看、关键字搜索、颜色标记、按颜色筛选、只看置顶、置顶/取消置顶、删除
- 站点配置：主理人信息、空间介绍、视频号配置，头像/空间图/视频封面支持上传
- Mock 接口：基于 MSW 提供 `/api` 前缀的 RESTful 接口，便于后续切换真实服务

## 技术栈

- Vite 5
- React 18 + TypeScript
- Ant Design 5
- React Router v6 (`createBrowserRouter`)
- Zustand（登录态持久化）
- Axios（请求封装 + token 注入）
- MSW（Mock Service Worker）
- ESLint + Prettier
- Sass

## 默认登录账号

- 账号：`admin`
- 密码：`admin123`

## 本地启动

### npm

```bash
npm install
npm run dev
```

### pnpm

```bash
pnpm install
pnpm dev
```

开发环境默认访问地址通常为：`http://localhost:5173`

## 构建与预览

```bash
npm run build
npm run preview
```

## 环境变量

复制 `.env.example` 为本地环境文件后可按需调整：

```bash
VITE_API_BASE_URL=/api
VITE_ENABLE_MSW=true
```

- `VITE_API_BASE_URL`：请求前缀，当前默认走 `/api`
- `VITE_ENABLE_MSW`：是否启用 Mock，默认 `true`

## 图片上传能力

当前活动管理、海报管理与站点配置已接入 `ImageUploader` 组件，默认会：

1. 先在浏览器端压缩图片（长边不超过 1200，quality 0.8）
2. 再调用 `POST /api/admin/upload` 上传到 BFF
3. 上传成功后自动把表单值替换为云存储返回的 `https` 地址
4. 同时保留手动填写 URL 的兜底能力，兼容历史 URL / `cloud://` 值

## 生产环境接入说明

本仓库当前采用“方案 A”：`worker_house_admin/.env.production` 里保留 BFF 占位地址 `https://your-worker-house-bff.example.com/api`。
在你把 `worker_house_bff` 手动部署到微信云托管（或其它可公网访问环境）之后，需要把这个地址替换成真实 BFF `/api` 域名，再重新构建并部署管理后台。

## 目录结构

```text
worker_house_admin/
├── public/
│   ├── 404.html
│   └── mockServiceWorker.js
├── src/
│   ├── components/
│   ├── hooks/
│   ├── layouts/
│   ├── mocks/
│   ├── pages/
│   ├── router/
│   ├── services/
│   ├── store/
│   ├── styles/
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── eslint.config.js
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 页面说明

### 登录页 `/login`

- 使用 Ant Design Form 构建
- 默认预填演示账号，便于快速体验
- 登录成功后写入 token 和用户信息到 Zustand，并自动跳转到 `/dashboard`

### Dashboard `/dashboard`

- 展示 6 张概览卡片（活动、留言墙与海报统计）
- 展示最近 5 条活动列表
- 数据基于活动、留言墙与海报接口前端聚合计算

### 活动管理 `/activity`

- 支持标题搜索与状态筛选
- 支持新增、编辑、删除活动
- 新增/编辑页按照小程序 `Activity` 类型组织表单字段

### 海报管理 `/poster`

- 支持列表查看与分页
- 展示封面缩略图、详情图数量、启用状态与排序值
- 支持海报新增、编辑、删除
- 支持在列表中直接切换启用状态和调整排序值

### 留言墙管理 `/wall`（兼容 `/treehole` 重定向）

- 支持内容关键字搜索
- 支持只看置顶开关
- 支持按便利贴颜色多选筛选
- 支持帖子删除、置顶、取消置顶
- 列表按置顶优先、发布时间倒序展示

### 站点配置 `/site-config`

- 单页表单维护主理人信息（姓名、头像、简介）
- 配置空间展示图片与空间介绍文案
- 配置视频号 ID、视频 Feed ID、封面图与标题

## 后续接入真实后端时需要改的点

1. 将 `.env` 中的 `VITE_API_BASE_URL` 改成真实后端地址。
2. 将 `VITE_ENABLE_MSW` 设为 `false`，或移除 `src/main.tsx` 中的 MSW 初始化逻辑。
3. 保持当前 `src/services/` 下的接口定义不变，后端按已有 RESTful 协议对接即可。
4. 若真实后端返回结构不同，只需同步调整 `services/` 层和少量页面映射逻辑。

## 后续接云开发

当接入微信云开发时，推荐按照如下步骤改造：

1. 部署一个 Node Express BFF（或者直接在管理后台前端调用云函数 HTTP 触发器，但需要处理鉴权），用于将管理后台的 REST 请求转发到云函数 HTTP 触发器。
2. 将 `.env` 中的 `VITE_API_BASE_URL` 替换为 BFF 地址。
3. 关闭 MSW：将 `VITE_ENABLE_MSW` 设为 `false`，或在启动逻辑中移除 MSW 初始化。

## 部署说明

项目构建后会生成 `dist/` 目录，可直接作为静态站点部署。仓库中已提供 `public/404.html` 用于 SPA 场景下的路由兜底跳转。
