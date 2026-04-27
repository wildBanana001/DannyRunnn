# 微信小程序体验版上传报告（worker_house）

## 1. AppID 修改情况

- 修改前 appid：`touristappid`
- 修改后 appid：`wx06f0bff0bed0dc80`
- 修改文件：`worker_house/project.config.json`
- 构建产物中的 appid：`worker_house/dist/project.config.json` 中的 `appid` 字段已为 `wx06f0bff0bed0dc80`

## 2. 重新构建信息

- 构建命令：`npm run build:weapp`
- 构建工具：Taro 4.1.9
- 构建耗时：约 **5.76s**（以 Taro Webpack 输出为准）
- 构建产物目录：`worker_house/dist/`
- 构建产物整体体积：约 **648K**（`du -sh dist`）

## 3. 上传配置与命令

- 上传脚本：`worker_house/scripts/ci-upload.js`
- 使用库：`miniprogram-ci@^2.1.26`
- Project 配置：
  - `appid`: `wx06f0bff0bed0dc80`
  - `type`: `miniProgram`
  - `projectPath`: `worker_house/`（脚本中 `path.resolve(__dirname, '..')`）
  - `privateKeyPath`: `worker_house/.keys/private.wx06f0bff0bed0dc80.key`
  - `ignores`: `['node_modules/**/*']`
- 上传命令：在 `worker_house/` 目录执行

  ```bash
  node scripts/ci-upload.js > ci-upload.log 2>&1
  ```

- 版本号：`1.0.0`
- 版本备注：`首次发布 - 体验版`
- 机器人编号（robot）：`1`
- 接口：使用 `ci.upload`，**未调用任何审核或 `uploadWithSourceMap` 相关 API**

## 4. 上传结果

- 上传结果：**失败**（在本地打包/校验阶段就被 miniprogram-ci 拦截，**未真正向微信服务器上传**）
- 完整日志：`worker_house/ci-upload.log`

### 4.1 关键错误信息

miniprogram-ci 在处理 `dist/app.json` 时返回错误：

- 错误码：`10009`
- 相关文件：`dist/app.json`
- 关键报错内容（节选）：

  ```text
dist/app.json: ["tabBar"]["list"][0]["iconPath"] Wrong file format, only .png、.jpg、.jpeg format is supported
["tabBar"]["list"][0]["selectedIconPath"] Wrong file format, only .png、.jpg、.jpeg format is supported
["tabBar"]["list"][1]["iconPath"] Wrong file format, only .png、.jpg、.jpeg format is supported
["tabBar"]["list"][1]["selectedIconPath"] Wrong file format, only .png、.jpg、.jpeg format is supported
["tabBar"]["list"][2]["iconPath"] Wrong file format, only .png、.jpg、.jpeg format is supported
["tabBar"]["list"][2]["selectedIconPath"] Wrong file format, only .png、.jpg、.jpeg format is supported
["tabBar"]["list"][3]["iconPath"] Wrong file format, only .png、.jpg、.jpeg format is supported
["tabBar"]["list"][3]["selectedIconPath"] Wrong file format, only .png、.jpg、.jpeg format is supported
  ```

对应的 `dist/app.json` 中配置为（节选）：

```json
{
  "tabBar": {
    "list": [
      {
        "pagePath": "pages/home/index",
        "text": "首页",
        "iconPath": "assets/icons/home.svg",
        "selectedIconPath": "assets/icons/home-active.svg"
      },
      {
        "pagePath": "pages/activities/index",
        "text": "活动",
        "iconPath": "assets/icons/activity.svg",
        "selectedIconPath": "assets/icons/activity-active.svg"
      },
      {
        "pagePath": "pages/treehole/index",
        "text": "树洞",
        "iconPath": "assets/icons/treehole.svg",
        "selectedIconPath": "assets/icons/treehole-active.svg"
      },
      {
        "pagePath": "pages/profile/index",
        "text": "我的",
        "iconPath": "assets/icons/profile.svg",
        "selectedIconPath": "assets/icons/profile-active.svg"
      }
    ]
  }
}
```

可以看到，当前 tabBar 使用的是 `.svg` 图标，而 miniprogram-ci / 微信小程序官方只接受 **`.png`、`.jpg`、`.jpeg`** 格式的图标文件，因此在本地打包阶段即失败，未生成可上传的体验版包。

### 4.2 包大小与上传耗时

由于在 `app.json` 校验阶段就出现错误，**上传流程并未进入真正的「上传到微信服务器」步骤**，因此：

- 体验版包大小：**未生成有效上传包，暂不可用**
- 上传耗时：实质上传未发生，只有本地打包与校验耗时（量级在数秒内），但不具备参考意义

## 5. 用户下一步操作建议

当前阻塞点不在网络、AppID 或密钥，而在 **tabBar 图标格式不符合要求**。建议按以下步骤处理：

1. **修复 tabBar 图标格式**：
   - 将 `assets/icons/` 下的 tabBar 图标资源从 `.svg` 转换为 `.png`（推荐），或 `.jpg` / `.jpeg`；
   - 更新源代码中的 tabBar 配置（通常在 `src/app.config.ts` 或相关配置文件中），确保生成到 `dist/app.json` 的 `iconPath` / `selectedIconPath` 后缀为 `.png` / `.jpg` / `.jpeg`；
   - 再次执行 `npm run build:weapp`，确认 `dist/app.json` 中的路径已经指向符合规范的图片格式。

2. **重新上传体验版**：
   - 在 `worker_house/` 目录下重新执行：

     ```bash
     npm run build:weapp
     node scripts/ci-upload.js > ci-upload.log 2>&1
     ```

   - 若上传成功，`ci-upload.log` 中会包含包大小、subpackage 信息等字段，可据此记录体验版包大小与上传耗时。

3. **在微信公众平台查看并体验开发版**（待上传成功后）：
   - 登录微信公众平台（小程序后台）；
   - 进入「版本管理」→「开发版」页面；
   - 在开发版列表中找到本次上传的版本（版本号 `1.0.0`，备注 `首次发布 - 体验版`）；
   - 点击「体验版」或扫描对应二维码进行体验；
   - 如需给团队成员体验，可在该页面将该版本标记为体验版并配置体验成员。

---

**本次结论**：

- AppID 已从 `touristappid` 正确切换为真实 AppID `wx06f0bff0bed0dc80`，构建产物中的 appid 也已同步更新；
- Taro weapp 构建成功，产物体积约 648K；
- 使用 `miniprogram-ci` 的上传流程已跑通，但由于 tabBar 图标格式为 `.svg`，在本地打包校验阶段被 miniprogram-ci 拦截，**未能成功上传体验版**；
- 需先修复图标格式问题后，再重新执行上传流程，之后即可在微信公众平台「版本管理 → 开发版」中查看和体验最新版本。

## 第二次上传（修复 tabBar 图标后）

### 1. 图标修复情况

- tabBar 使用的 8 个图标已从 `.svg` 转为 81×81 的 `.png`，对应关系如下：
  - `assets/icons/home.svg` → `assets/icons/home.png`
  - `assets/icons/home-active.svg` → `assets/icons/home-active.png`
  - `assets/icons/activity.svg` → `assets/icons/activity.png`
  - `assets/icons/activity-active.svg` → `assets/icons/activity-active.png`
  - `assets/icons/treehole.svg` → `assets/icons/treehole.png`
  - `assets/icons/treehole-active.svg` → `assets/icons/treehole-active.png`
  - `assets/icons/profile.svg` → `assets/icons/profile.png`
  - `assets/icons/profile-active.svg` → `assets/icons/profile-active.png`
- 转换脚本：`worker_house/scripts/convert-svg-to-png.js`
  - 使用 `sharp` 将上述 8 个 SVG 渲染为 81×81 的透明背景 PNG 图标；
  - 每次执行时会强制从 SVG 重新生成 PNG，确保以源码 SVG 为准。
- 构建后的 `dist/app.json` 中，`tabBar.list[*].iconPath` / `selectedIconPath` 均已改为 `.png` 结尾，已符合 miniprogram-ci / 微信对 tabBar 图标格式的要求。

### 2. 重新构建信息

- 构建命令：`npm run build:weapp`
- 构建工具：Taro 4.1.9
- 构建耗时：约 **5.46s**（以 Webpack 编译耗时输出为准）
- 构建产物目录：`worker_house/dist/`
- 构建产物整体体积：约 **648K**（`du -sh dist`）
- 构建结果：成功，`dist/app.json` 与 `dist/assets/icons/*.png` 均已生成且配置正确。

### 3. 第二次上传结果

- 上传命令：在 `worker_house/` 目录执行：

  ```bash
  node scripts/ci-upload.js > ci-upload.log 2>&1
  ```

- 上传结果：**失败（本地打包与配置校验已通过，失败发生在请求微信服务器阶段）**。
- 日志标志（`worker_house/ci-upload.log`）：
  - 构建流程完整执行，日志中包含：
    - `getCodeFiles: count: 36, cost: 2130ms.`
    - `upload zip buffer size:  373991`（说明上传包已成功打包，体积约 365KB）；
  - 日志末尾未出现 `UPLOAD_RESULT:` 字段，但出现 `UPLOAD_FAILED`：

    ```text
    [error] 20003 Error: {"errCode":-10008,"errMsg":"invalid ip: 114.251.196.98, reference: https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html"}
    UPLOAD_FAILED: CodeError: Error: {"errCode":-10008,"errMsg":"invalid ip: 114.251.196.98, reference: https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html"}
    ```

- 关键结论：
  - 之前的报错（`dist/app.json` 中 tabBar 使用 `.svg` 图标导致错误码 `10009`）已完全消除，本次构建与本地校验均通过；
  - 当前阻塞点为 **微信侧 CI 上传 IP 白名单**，具体错误为：当前运行 `miniprogram-ci` 的机器出口 IP `114.251.196.98` 不在小程序后台配置的 CI IP 白名单内，导致微信服务器拒绝本次上传请求（`errCode: -10008`, `errMsg: invalid ip`）。

### 4. 下一步排查与处理建议

1. 登录微信公众平台（小程序后台），进入「开发」→「开发设置」页面，找到 CI 上传相关的 IP 白名单配置入口；
2. 将当前环境出口 IP `114.251.196.98`（或公司统一提供的 CI 代理出口 IP / 网段）加入到小程序的 CI 白名单中；
3. 保存配置并等待白名单生效（通常需要数分钟，具体以微信官方文档为准）；
4. 生效后，在当前环境再次执行：

   ```bash
   npm run build:weapp
   node scripts/ci-upload.js > ci-upload.log 2>&1
   ```

5. 若再次失败，可根据新的 `ci-upload.log` 错误信息继续排查（例如密钥、AppID、网络异常等），并在本报告中追加新的上传记录。

> 一旦 IP 白名单配置正确且上传成功，预期 `ci-upload.log` 中将出现 `UPLOAD_RESULT:` 字段以及 `subPackageInfo` 等包体信息，届时可进一步记录最终体验版包大小和分包结构。

## 第三次上传（白名单修复后）

### 1. 上传配置与命令

- 上传命令：在 `worker_house/` 目录下执行：
  ```bash
  node scripts/ci-upload.js > ci-upload.log 2>&1
  ```
- 环境说明：用户已将 `114.251.196.98` 加入白名单。

### 2. 第三次上传结果

- 上传结果：**失败（IP 漂移导致白名单失效）**。
- 日志标志（`worker_house/ci-upload.log`）：
  - 错误原文：
    ```text
    [error] 20003 Error: {"errCode":-10008,"errMsg":"invalid ip: 114.251.196.105, reference: https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html"}
    UPLOAD_FAILED: CodeError: Error: {"errCode":-10008,"errMsg":"invalid ip: 114.251.196.105, reference: https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html"}
    ```
- 关键结论：
  - 之前的 IP `114.251.196.98` 已加入白名单，但本次执行时，当前环境的出口 IP 变更为 **`114.251.196.105`**。
  - 由于新 IP `114.251.196.105` 不在微信侧白名单内，上传请求再次被拒绝（`errCode: -10008`）。

### 3. 下一步处理建议

1. 请再次登录微信公众平台，将最新的出口 IP **`114.251.196.105`** 也加入到 CI 上传的 IP 白名单中。
2. 建议保留之前的 `114.251.196.98`（以防 IP 再次跳回），或者如果可能，请咨询是否可以配置 IP 段白名单（如 `114.251.196.0/24`），以彻底解决 IP 漂移问题。
3. 加入新 IP 后，请告知我，我将再次尝试上传。

## 第四次上传（更新白名单后再次尝试）

### 1. 上传配置与命令

- 上传命令：在 `worker_house/` 目录下执行：
  ```bash
  node scripts/ci-upload.js > ci-upload.log 2>&1
  ```
- 环境说明：用户已更新微信小程序 CI 上传 IP 白名单，尝试再次触发。

### 2. 第四次上传结果

- 上传结果：**失败（再次发生 IP 漂移）**。
- 日志标志（`worker_house/ci-upload.log`）：
  - 错误原文：
    ```text
    [error] 20003 Error: {"errCode":-10008,"errMsg":"invalid ip: 124.126.104.105, reference: https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html"}
    UPLOAD_FAILED: CodeError: Error: {"errCode":-10008,"errMsg":"invalid ip: 124.126.104.105, reference: https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html"}
    ```
- 关键结论：
  - 本次出口 IP 变更为 **`124.126.104.105`**。
  - 由于该 IP 尚未加入微信公众平台的 CI IP 白名单，导致上传请求再次被拒绝（`errCode: -10008`）。

### 3. 下一步处理建议

1. 请将最新的出口 IP **`124.126.104.105`** 加入到微信公众平台的小程序 CI IP 白名单中。
2. 由于该环境出口 IP 频繁漂移，强烈建议：
   - 如果支持 CIDR，可尝试将整个网段（如 `124.126.104.0/24` 或 `114.251.196.0/24` 等，视公司网络配置而定）加入白名单；
   - 或者持续将报错中出现的新 IP 逐个添加。
3. 添加完毕后请再次告知，我将继续尝试上传。

