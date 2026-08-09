# worker_house_bff 云托管 CI/CD Runbook

## 当前生产配置

- GitHub 仓库：`wildBanana001/DannyRunnn`
- 生产分支：`main`
- 云开发环境：`prod-d9g991lo4dba5a4da`
- 云托管服务：`worker-house-bff`
- 构建目录：`worker_house_bff`
- Dockerfile：`worker_house_bff/Dockerfile`
- 容器端口：`8080`

> 注意：当前远程默认分支是 `main`。云托管必须绑定该分支，推送代码才会触发部署。

## 流水线

```text
PR / push -> GitHub Actions -> npm ci -> TypeScript 编译
                                -> HTTP 冒烟测试
                                -> Docker 镜像构建校验

push / merge to main -> 微信云托管 Webhook -> 拉取 worker_house_bff
                                                 -> 构建镜像
                                                 -> 发布新版本
```

GitHub Actions 配置位于 `.github/workflows/bff-ci.yml`。CD 使用微信云托管官方 Git 自动部署，不需要在 GitHub 中存放腾讯云永久 SecretId / SecretKey。

## 一次性开启 CD

1. 打开微信云托管的 `worker-house-bff` 服务更新页。
2. 部署方式选择“通过 Git 仓库部署”，授权 GitHub 账号。
3. 选择仓库 `wildBanana001/DannyRunnn`。
4. 分支选择 `main`。
5. 目标目录 / Dockerfile 目录填 `worker_house_bff`。
6. Dockerfile 名称填 `Dockerfile`，服务端口填 `8080`。
7. 开启“自动部署”，触发规则选择 push 到 `main`（PR 合并最终也是一次 `main` push）。
8. 选择部署成功后自动切换 100% 流量；生产环境如需人工验证，则改用灰度发布。
9. 保存并执行一次手动部署，确认 GitHub Webhook 授权和构建参数生效。

## 环境变量

云端更新部署来源时，不要覆盖现有敏感环境变量。最低基础配置为：

```bash
NODE_ENV=production
MODE=cloudrun
ALLOW_EPHEMERAL_CLOUDRUN_DATA=false
SHOP_ORDER_STORAGE=mysql
MYSQL_ADDRESS=<微信云托管 MySQL 内网地址:3306>
MYSQL_USERNAME=<通过云托管 Secret 配置>
MYSQL_PASSWORD=<通过云托管 Secret 配置>
MYSQL_DATABASE=worker_house
MYSQL_CONNECTION_LIMIT=5
MYSQL_AUTO_MIGRATE=true
CLOUD_ENV_ID=<云开发环境 ID>
CLOUD_APP_ID=<小程序 AppID>
CLOUD_APP_SECRET=<通过云托管 Secret 配置>
CLOUD_ADMIN_SERVICE_TOKEN=<通过云托管 Secret 配置>
```

`ENABLE_SHOP` 与 `ENABLE_COMMUNITY_WALL` 不属于上面的部署清单；请在云托管服务变量中单独维护，避免自动部署覆盖运行时开关。支付、管理员与 MySQL 密码必须继续放在云托管 Secret 中，不得写入 Git。支付配置及订单存储 readiness 验证通过后，才在服务变量中把 `ENABLE_SHOP` 设置为 `true`；开关关闭期间支付回调与已有订单查询仍保持可用。留言墙只有在 `ENABLE_COMMUNITY_WALL=true` 时才会出现在小程序中，默认关闭。有限名额的活动会在 MySQL 事务内原子占位。

`MYSQL_ADDRESS` 必须使用生产内网地址。若云开发 MySQL 控制台提示该实例需要 VPC，请在 `worker-house-bff` 的“服务设置 → 网络配置”中开启私有网络，并选择数据库所在 VPC；单独设置环境变量不会打通网络。参考 CloudBase 官方的 [MySQL 数据库集成](https://docs.cloudbase.net/run/develop/resource-integration/mysql) 和 [直连服务](https://docs.cloudbase.net/database/configuration/db/tdsql/direct-connection)。

如果服务变量中还残留 `SHOP_ORDER_STORAGE=cloudbase`，新版本会在启动时临时兼容为 `mysql` 并记录警告；部署稳定后请删除该旧变量，使用仓库清单中的 `SHOP_ORDER_STORAGE=mysql`。

首次启用时必须等新版本完成部署并切换到 100% 流量，再设置 `ENABLE_SHOP=true`；不要在新旧实例分别写 CloudBase 与 MySQL 的滚动阶段提前开单。若旧版已经产生支付订单，应先暂停新单与支付回调，完成历史订单迁移和核对。

本项目的 `container.config.json` 不声明 `ENABLE_SHOP` 或 `ENABLE_COMMUNITY_WALL`，两个开关都由云托管服务变量管理，自动部署不会覆盖控制台设置。支付联调期间，当前上架的瓶装饮用水和 6 款到店享用酒水统一为 ¥0.01，均按不限库存商品处理；如果后续新增限量商品，应先为商品补充独立的事务预占。

## 验证

1. GitHub 的 `BFF CI` 工作流应绿灯通过。
2. 云托管操作历史应出现对应 `main` commit 的新版本。
3. `GET /health` 应返回 HTTP `200`。
4. `GET /api/health` 在持久化数据源未就绪时预期返回 HTTP `503` 和 `configuration_required`；这不代表容器启动失败。
5. 开启支付后，`GET /api/shop/readiness` 应返回 `ready=true`；小程序支付模式已在 `src/constants/runtime.ts` 固定为 `cloudrun`。
6. 连续请求数次 `GET /api/shop/readiness`，确认 `orderStorage.ready` 始终为 `true`；若反复出现 `ECONNRESET`，优先核对数据库实例状态、生产内网地址以及服务的 VPC 网络配置。
7. `GET /api/site-config` 应返回与服务变量一致的 `communityWallEnabled`；设置 `ENABLE_COMMUNITY_WALL=true` 后重新进入首页即可看到留言墙入口。

## 手动备用部署

只有在 Git Webhook 暂时不可用时才使用 CLI：

```bash
npm install --global @cloudbase/cli@3.6.4
tcb login
tcb cloudrun deploy \
  --env-id prod-d9g991lo4dba5a4da \
  --serviceName worker-house-bff \
  --port 8080 \
  --source ./worker_house_bff \
  --force
```

## 回滚

1. 进入 `worker-house-bff` 的版本 / 流量管理。
2. 将 100% 流量切回上一个已验证版本。
3. 回滚代码后再合并到 `main`，让自动部署恢复到 Git 中的正确状态。

## 不触发时的排查顺序

1. 确认提交已推送到 `origin/main`，而不是一个本地分支。
2. 确认云托管绑定分支是 `main`。
3. 确认“自动部署”开关已开启，GitHub 授权没有过期。
4. 确认目标目录是 `worker_house_bff`，Dockerfile 名称是 `Dockerfile`。
5. 在 GitHub 仓库 Webhooks 中查看最近一次请求是否成功。
6. 在云托管构建日志中区分“没触发”、“构建失败”和“启动失败”。
