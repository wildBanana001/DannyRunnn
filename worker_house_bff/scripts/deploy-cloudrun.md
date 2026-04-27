# worker_house_bff 云托管部署 Runbook

本文档仅作为部署说明，不会在本轮任务里实际执行部署。

## 一、前置准备

1. 先在微信公众平台为小程序 `wx06f0bff0bed0dc80` 开通云托管。
2. 开通完成后，记录环境 ID，格式通常类似 `prod-xxxx`。
3. 部署前确认仓库内已包含以下文件：
   - `Dockerfile`
   - `.dockerignore`
   - `container.config.json`

## 二、部署方式

### 方式 A：公众平台控制台上传代码包（推荐）

1. 打开公众平台控制台。
2. 进入 **云托管 → 服务管理 → 新建服务**。
3. 选择 **上传代码包**。
4. 将 `worker_house_bff/` 打成 zip 后上传。
5. 打包时不要包含：
   - `node_modules`
   - `dist`
   - `.env*`
   - `logs`
6. 确认控制台读取到 `container.config.json` 中的端口与伸缩配置。
7. 完成发布并等待服务启动。

## 三、方式 B：使用 `@cloudbase/cli` CLI 部署

> 该方式需要用户本人具备可用的云托管 / CI 凭据，本轮仅提供命令示例。

```bash
npm install -g @cloudbase/cli
cloudbase login
cloudbase functions:deploy worker-house-bff --envId <你的环境ID>
```

如果团队后续采用 CLI，请以用户自己的凭据和实际服务名为准，再补充正式 CI 脚本。

## 四、部署后的服务设置

1. 进入 **服务设置 → 公网访问**，按需开启公网访问。
2. 如果小程序直接通过 `wx.cloud.callContainer` 调用，推荐优先使用这种方式：
   - 免 HTTPS 证书处理
   - 免自建鉴权
   - 微信会自动注入 `X-WX-OPENID` 等身份 Header
3. 若需要排查容器状态，可先访问：
   - `GET /api/health`

## 五、小程序切换步骤

部署完成后，在 `worker_house/.env` 中至少配置：

```bash
TARO_APP_API_MODE=cloudrun
TARO_APP_CLOUDRUN_ENV=<你的环境ID>
TARO_APP_CLOUDRUN_SERVICE=worker-house-bff
```

然后重新执行小程序构建与上传：

```bash
cd worker_house
npm run build:weapp
```

接着在开发者工具中重新 upload 即可。

## 六、交接说明

当前仓库已完成“云托管就绪”改造，但尚未真正部署。待用户提供真实环境 ID 后，可基于本 Runbook 继续执行部署任务。
