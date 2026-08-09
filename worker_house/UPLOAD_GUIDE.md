# 微信开发者工具手动上传体验版指南

本指南旨在帮助开发者在 CI 自动上传受限（如 IP 白名单问题）时，通过微信开发者工具手动完成 `worker_house` 小程序的构建与上传。

## 0. GitHub Actions 自动上传（推荐）

仓库已配置 `.github/workflows/miniprogram-preview.yml`。向 `main` 推送小程序代码后，流水线会：

1. 执行 `npm ci` 和 `npm run build:weapp`。
2. 通过微信官方 `miniprogram-ci` 上传一个“开发版本”。
3. 生成首页预览二维码。
4. 将二维码、上传结果和 manifest 保存为 GitHub Actions 产物，保留 7 天。

### 一次性配置

1. 使用小程序管理员身份进入微信公众平台的 **开发管理 → 开发设置 → 小程序代码上传**，生成并下载上传密钥。
2. 在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 新建 Secret：
   - 名称：`WECHAT_MINIPROGRAM_CI_PRIVATE_KEY`
   - 值：密钥文件的全部内容，包含 PEM 换行。
3. 配置上传 IP：
   - 更安全的做法：使用拥有固定出口 IP 的 self-hosted runner，将 IP 加入微信白名单，并把 GitHub Variable `WECHAT_MINIPROGRAM_RUNNER` 设为该 runner label。
   - 快速做法：继续使用 `ubuntu-latest`，在微信平台关闭代码上传 IP 限制。GitHub 托管 runner 的出口 IP 会变动，不适合单一 IP 白名单。

可选 GitHub Variables：

- `WECHAT_MINIPROGRAM_ROBOT`：`1` 到 `30`，默认 `1`。

CI 上传的开发版已固定使用 `TARO_APP_API_MODE=cloudrun`。支付模式、云环境 ID 和云托管服务名也已固定，不再依赖 GitHub Variables，避免真实微信登录被错误构建成 mock 身份。

自动化只上传开发版本并生成预览码，不会自动提交审核、切换体验版或发布正式版。

> 项目 `.npmrc` 会将历史锁文件中的内部 npm 镜像地址替换为公共 npm registry，以便 GitHub Runner 可以安装依赖。

## 1. 前置准备
- **下载工具**：安装最新稳定版 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
- **AppID**：确保你有权限访问 AppID `wx06f0bff0bed0dc80`。

## 2. 导入项目
1. 打开微信开发者工具，点击 **"导入"**。
2. **项目目录**：选择 `worker_house/` 根目录（注意：不是 `dist/` 目录）。
3. **AppID**：填写 `wx06f0bff0bed0dc80`。
4. **开发模式**：选择 "小程序"。

## 3. 本地构建
由于项目采用 Taro 框架，需要先将 TSX 代码编译为小程序原生代码：
1. 在终端进入项目根目录：
   ```bash
   cd worker_house
   npm install --legacy-peer-deps
   ```
2. 执行构建命令：
   ```bash
   TARO_APP_API_MODE=cloudrun npm run build:weapp
   ```
3. 开发者工具会自动监听 `worker_house/dist/` 目录的变化。如果工具未自动刷新，可以手动点击工具栏顶部的 **"编译"** 按钮。

## 4. 关联云开发环境（重要）
1. 点击开发者工具左上角的 **"云开发"** 按钮。
2. 在打开的云开发控制台中，创建或选择一个现有的云开发环境。
3. 复制 **环境 ID (Env ID)**。
4. 确认 `src/constants/runtime.ts` 中的环境 ID 与当前生产云环境一致。
5. **再次运行** `npm run build:weapp` 以确保配置生效。

## 5. 部署云函数
项目依赖云函数实现核心逻辑，需要依次部署：
1. 在开发者工具左侧目录树中，展开 `cloudfunctions/` 目录。
2. 依次右键点击以下 5 个云函数文件夹：
   - `poster`
   - `activity`
   - `post`
   - `site_config`
   - `admin_auth`
3. 选择 **"上传并部署：云端安装依赖"**。

> `_seed` 会清空并重建业务集合，禁止作为常驻生产云函数部署。它默认不可执行，仅限首次开发环境初始化时临时配置 `ALLOW_SEED_RESET / SEED_ADMIN_TOKEN / SEED_ADMIN_OPENIDS` 后使用，并应在初始化完成后立即从云端删除。

## 6. 初始化数据库
1. 进入 **云开发控制台** -> **数据库**。
2. 手动创建以下 6 个集合 (Collection)：
   - `posters`
   - `activities`
   - `posts`
   - `comments`
   - `site_config`
   - `admins`
3. 如需初始化开发环境种子数据，先确认目标环境不是生产环境，再临时部署 `_seed` 并设置三项保护变量；执行时必须同时传入匹配的 `token` 与 `confirm=RESET_WORKER_HOUSE_DEMO_DATA`，完成后删除云端 `_seed`。
   - 输入参数 `{"token":"<SEED_ADMIN_TOKEN>","confirm":"RESET_WORKER_HOUSE_DEMO_DATA"}`，点击 **"运行"**。只有环境开关、令牌和调用者 OpenID 三项都匹配时才会执行。

## 7. 预览与上传体验版
1. **预览**：点击右上角 **"预览"** 按钮，扫码可在手机上实际操作。
2. **上传**：
   - 确认无误后，点击右上角 **"上传"** 按钮。
   - **版本号**：输入如 `0.2.0`。
   - **项目备注**：输入如 "复古手账风改造 + 云开发接入"。
3. **设置为体验版**：
   - 登录 [微信公众平台](https://mp.weixin.qq.com/)。
   - 进入 **版本管理** -> **开发版本**。
   - 找到刚上传的版本，点击 **"选为体验版"**。
   - 在 "成员管理" 中添加体验者的微信号，即可扫码体验。

## 8. 常见问题 (FAQ)
- **代码包体积过大**：如果提示超过 2MB，请检查 `src/assets` 目录下是否有未压缩的大图，建议将其迁移至云存储。
- **云函数调用失败**：请确认：
  - Env ID 是否配置正确。
  - 云函数是否已部署（显示绿色云图标）。
  - 数据库集合名是否拼写正确且已创建。
- **图片加载失败**：小程序要求外部图片域名必须配置白名单，但**云存储 (cloud://...) 路径的图片不受此限制**，推荐使用。
