# worker_house 改造说明

## 改动文件列表

### 前端主题与基础设施
- `src/app.config.ts`
- `src/app.scss`
- `src/app.ts`
- `src/styles/theme.ts`
- `src/styles/theme.scss`
- `src/styles/variables.scss`
- `src/cloud/index.ts`
- `src/cloud/services.ts`
- `src/utils/helpers.ts`
- `src/utils/video.ts`
- `project.config.json`

### 类型与本地 fallback 数据
- `src/types/activity.ts`
- `src/types/post.ts`
- `src/types/site.ts`
- `src/data/activities.ts`
- `src/data/posts.ts`
- `src/data/posters.ts`
- `src/data/site.ts`
- `src/data/users.ts`

### 页面与组件改造
- `src/components/Button/index.tsx`
- `src/components/Button/index.module.scss`
- `src/pages/home/index.tsx`
- `src/pages/home/index.module.scss`
- `src/pages/home/index.config.ts`
- `src/pages/activity/index.tsx`
- `src/pages/activity/index.module.scss`
- `src/pages/activity/index.config.ts`
- `src/pages/wall/index.tsx`
- `src/pages/wall/index.module.scss`
- `src/pages/wall/index.config.ts`
- `src/pages/wall/components/NoteCard.tsx`
- `src/pages/wall/components/note-card.module.scss`
- `src/pages/wall/components/PostModal.tsx`
- `src/pages/wall/components/post-modal.module.scss`
- `src/pages/wall-publish/index.tsx`
- `src/pages/wall-publish/index.module.scss`
- `src/pages/wall-publish/index.config.ts`
- `src/pages/mine/index.tsx`
- `src/pages/mine/index.module.scss`
- `src/pages/mine/index.config.ts`
- `src/pages/poster-detail/index.tsx`
- `src/pages/poster-detail/index.module.scss`
- `src/pages/poster-detail/index.config.ts`
- `src/pages/activity-detail/index.tsx`
- `src/pages/activity-detail/index.module.scss`
- `src/pages/registration/index.tsx`
- `src/pages/_deprecated/treehole/*`

### 微信云开发
- `cloudfunctions/README.md`
- `cloudfunctions/poster/index.js`
- `cloudfunctions/poster/package.json`
- `cloudfunctions/activity/index.js`
- `cloudfunctions/activity/package.json`
- `cloudfunctions/post/index.js`
- `cloudfunctions/post/package.json`
- `cloudfunctions/site_config/index.js`
- `cloudfunctions/site_config/package.json`
- `cloudfunctions/admin_auth/index.js`
- `cloudfunctions/admin_auth/package.json`
- `cloudfunctions/_seed/index.js`
- `cloudfunctions/_seed/package.json`

### 占位素材（等待并行素材任务覆盖）
- `src/assets/illustrations/tv-frame.png`
- `src/assets/illustrations/avatar-frame.png`
- `src/assets/illustrations/tape.png`
- `src/assets/illustrations/cloud.png`
- `src/assets/tabbar/tab-home-normal.png`
- `src/assets/tabbar/tab-home-active.png`
- `src/assets/tabbar/tab-activity-normal.png`
- `src/assets/tabbar/tab-activity-active.png`
- `src/assets/tabbar/tab-wall-normal.png`
- `src/assets/tabbar/tab-wall-active.png`
- `src/assets/tabbar/tab-mine-normal.png`
- `src/assets/tabbar/tab-mine-active.png`

## 云开发需要手动完成的事项

1. 在微信云开发控制台创建环境，并把 `src/cloud/index.ts` 里的 `YOUR_CLOUD_ENV_ID` 替换成真实环境 ID。
2. 在微信开发者工具里右键部署 `cloudfunctions/` 下的 `poster`、`activity`、`post`、`site_config`、`admin_auth`、`_seed` 六个云函数。
3. 在云数据库中创建集合：`posters`、`activities`、`posts`、`comments`、`site_config`、`admins`。
4. 运行 `_seed` 云函数初始化开发数据。该函数会先清空业务集合，再重新写入种子数据，适合开发环境反复执行。
5. 如果需要后台管理权限，请在 `admins` 集合中写入管理员账号数据，字段至少包含 `username`、`password`、`token`。
6. 部署后在后台或数据库里补充/维护首页海报、空间介绍、主理人信息、视频号信息等正式内容。

## 已知限制

1. 视频号打开能力受微信基础库和账号权限影响，当前实现会依次尝试视频号相关 API；若失败，会退化为复制视频号链接并提示用户手动打开。
2. 当前 `src/assets/illustrations/` 与 `src/assets/tabbar/` 为轻量占位素材，等并行素材任务产出后，直接覆盖同名文件即可。
3. `_seed` 云函数为开发初始化脚本，执行时会清空业务集合，不适合直接在生产环境使用。
4. `admin_auth` 云函数内保留了开发期默认账号逻辑，正式上线前建议改成数据库配置并替换默认凭据。

## 验证结果

- `npm install --legacy-peer-deps`：通过
- `standard-lint ... --rule-set one-site-ff9630ec-d4ee-4614-b4fa-195e2b73a74c --format`：通过
- `npx @byted/tsc-files-mono ...`：通过
- `npm run build:weapp`：通过
- `dist` 目录体积：`744K`
