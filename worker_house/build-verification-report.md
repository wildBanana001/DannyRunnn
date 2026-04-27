# worker_house 微信小程序构建验证报告

## 1. 验证概览

- 项目：worker_house（Taro 4.1.9 + React + TypeScript）
- 目标：验证能在本地成功构建微信小程序产物（`dist/`），为后续上传 / 上线做准备。
- 总体结论：构建 **成功**，`dist/` 产物结构完整，满足微信小程序基础要求；存在依赖 peer 冲突需使用 `--legacy-peer-deps` 规避，以及 `project.config.json` 中 appid 仍为占位符 `touristappid`，上线前必须替换。

## 2. 环境检查

- 工作目录：`worker_house/`
- Node.js 版本：`v22.22.2`
- npm 版本：`10.9.7`
- Taro CLI：通过 `npm run build:weapp` 间接调用 `taro build --type weapp`，实际执行版本为 **4.1.9**。
- 评估：Taro 官方推荐 Node 18+，当前 Node 22 处于兼容区间，构建过程未出现因 Node 版本导致的错误，仅有 `punycode` 模块废弃的 DeprecationWarning。

结论：环境检查 **✅**。

## 3. 依赖安装

### 3.1 初次安装尝试（失败）

执行命令为：

```bash
npm ci   # 首选
# 失败后自动回退
npm install
```

两次安装均失败，关键报错信息如下（节选）：

```text
npm error ERESOLVE could not resolve
...
While resolving: @tarojs/taro-loader@4.1.9
Found: webpack@5.78.0
...
Could not resolve dependency:
peer webpack@"5.91.0" from @tarojs/taro-loader@4.1.9
...
Fix the upstream dependency conflict, or retry this command with --force or --legacy-peer-deps
```

原因分析：

- 项目中 devDependency 固定了 `webpack@5.78.0`；
- `@tarojs/taro-loader@4.1.9` 的 peerDependency 要求 `webpack@5.91.0`；
- npm 在默认严格模式下无法同时满足两者的版本约束，导致 `ERESOLVE` 依赖冲突错误。

### 3.2 解决方案与最终安装结果（成功）

根据 npm 提示，改用宽松的 peer 依赖解析策略：

```bash
npm install --legacy-peer-deps
```

- 耗时：约 **24 秒**（脚本输出 `INSTALL_DURATION=24`）；
- 结果：
  - 新增 2243 个依赖包；
  - 安全扫描结果：`found 0 vulnerabilities`；
  - 仅有若干旧包的 deprecated 提示（如部分 `glob`、`request`、`core-js@2` 等），但不影响当前构建任务。

结论：依赖安装 **✅**（通过 `--legacy-peer-deps` 解决 peer 冲突）。需要注意目前 webpack 与 @tarojs/taro-loader 版本存在不一致，后续如需更严格的依赖治理，建议从根本上修复版本冲突（见第 7 节）。

## 4. 构建执行

- 构建命令：

```bash
npm run build:weapp
# scripts 中定义为：
# "build:weapp": "taro build --type weapp"
```

- 关键日志摘要：

  - Taro 启动：

    ```text
    👽 Taro v4.1.9
    ```

  - Webpack 编译进度正常推进，从 10% → 40% → 73% → 92% 等；

  - 最终输出：

    ```text
    ✔ Webpack
      Compiled successfully in 5.44s
    ```

- 脚本记录耗时：

  - `BUILD_DURATION=8`（单位：秒），包括 CLI 启动及收尾时间，整体在可接受范围内。

- 报错与警告：

  - 无构建错误；
  - 存在 Node 关于 `punycode` 模块废弃的 DeprecationWarning：

    ```text
    (node:...) [DEP0040] DeprecationWarning: The `punycode` module is deprecated.
    ```

    该警告不影响构建产物生成。

结论：构建执行 **✅**，微信小程序目标平台构建流程顺利完成。

## 5. 产物校验（`worker_house/dist/`）

- 产物目录：`worker_house/dist/`
- 目录总大小：约 **648 KB**（`du -sh dist` 输出 `648K`）；
- 文件数量：约 **58 个**（根据目录树手动统计，包括根目录文件、`assets/icons/` 与各 `pages/*` 下的 JS/JSON/WXML/WXSS 等）。

### 5.1 根目录结构（主要条目）

`dist/` 根目录包含以下关键文件与子目录：

- 入口相关：`app.js`、`app.json`、`app.wxss`、`app-origin.wxss`；
- 基础结构：`base.wxml`、`common.js`、`common.wxss`；
- 组件与运行时：`comp.js`、`comp.json`、`comp.wxml`、`runtime.js`、`taro.js`、`utils.wxs`；
- 依赖打包：`vendors.js`、`vendors.js.LICENSE.txt`、`app.js.LICENSE.txt`；
- 配置文件：`project.config.json`；
- 资源与页面：
  - `assets/icons/`（首页 / 活动 / 树洞 / 我的 等图标）；
  - `pages/`（包含各业务页面生成的 JS/JSON/WXML/WXSS）。

### 5.2 页面产物

`dist/pages/` 下包含以下页面目录，每个目录内包含标准的四/五件套文件（`index.js`、`index.json`、`index.wxml`、`index.wxss`，部分页面额外有 `index.js.LICENSE.txt`）：

- `pages/home/`
- `pages/activities/`
- `pages/treehole/`
- `pages/profile/`
- `pages/activity-detail/`
- `pages/registration/`
- `pages/past-activities/`
- `pages/post-detail/`

与源码 `src/app.config.ts` 中声明的 8 个页面一一对应。

### 5.3 app 入口文件存在性

- `dist/app.js`：存在；
- `dist/app.json`：存在；
- `dist/app.wxss`：存在。

结论：产物结构 **✅**，已生成完整的微信小程序构建目录，满足导入微信开发者工具的基础要求。

## 6. app.json 与应用配置检查

### 6.1 dist/app.json 校验

读取 `worker_house/dist/app.json`，关键内容如下（格式化后）：

```json
{
  "pages": [
    "pages/home/index",
    "pages/activities/index",
    "pages/treehole/index",
    "pages/profile/index",
    "pages/activity-detail/index",
    "pages/registration/index",
    "pages/past-activities/index",
    "pages/post-detail/index"
  ],
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#E63946",
    "backgroundColor": "#FFFFFF",
    "borderStyle": "white",
    "list": [
      { "pagePath": "pages/home/index", "text": "首页", "iconPath": "assets/icons/home.svg", "selectedIconPath": "assets/icons/home-active.svg" },
      { "pagePath": "pages/activities/index", "text": "活动", "iconPath": "assets/icons/activity.svg", "selectedIconPath": "assets/icons/activity-active.svg" },
      { "pagePath": "pages/treehole/index", "text": "树洞", "iconPath": "assets/icons/treehole.svg", "selectedIconPath": "assets/icons/treehole-active.svg" },
      { "pagePath": "pages/profile/index", "text": "我的", "iconPath": "assets/icons/profile.svg", "selectedIconPath": "assets/icons/profile-active.svg" }
    ]
  },
  "window": {
    "backgroundTextStyle": "dark",
    "navigationBarBackgroundColor": "#FAF8F5",
    "navigationBarTitleText": "活动报名",
    "navigationBarTextStyle": "black",
    "backgroundColor": "#FAF8F5"
  }
}
```

校验要点：

- `pages` 数组非空，包含 8 个页面路径；
- `tabBar` 与 `window` 配置与源码一致，字段完整且值合法；
- 与源码 `src/app.config.ts` 中导出的配置保持一一对应关系。

### 6.2 源码入口配置 src/app.config.ts

`worker_house/src/app.config.ts` 内容概览：

- `pages`：包含 `home`、`activities`、`treehole`、`profile`、`activity-detail`、`registration`、`past-activities`、`post-detail` 8 个页面；
- `tabBar`：4 个 tab，文本分别为「首页」「活动」「树洞」「我的」，图标路径均指向 `assets/icons/*.svg`；
- `window`：
  - `navigationBarBackgroundColor`: `#FAF8F5`；
  - `navigationBarTitleText`: `"活动报名"`；
  - `backgroundColor`: `#FAF8F5`。

评估：入口配置结构清晰，字段与类型符合 Taro / 小程序要求，且实际已正确编译到 `dist/app.json`，合理 **✅**。

## 7. Taro 配置与环境 URL 检查

### 7.1 config/index.ts

关键配置：

- `projectName`: `"taro_template"`；
- `outputRoot`: `process.env.TARO_OUTPUT_DIR || 'dist'`；
- `framework`: `'react'`；
- `mini`、`h5`、`rn` 配置主要集中在样式、缓存、打包产物命名与 `TsconfigPathsPlugin` 等构建细节上。

在 `config/index.ts` 中未发现硬编码的后端接口地址或测试环境 URL（如 `http://test...`、`ppe`、`boe` 等），当前更偏向于纯前端构建配置。

### 7.2 config/prod.ts

内容非常精简：

```ts
export default {
  mini: {},
  h5: {},
} satisfies UserConfigExport<'webpack5'>;
```

同样未包含任何环境 URL 或后端服务地址。

结论：

- `config/index.ts` 与 `config/prod.ts` 中 **未发现** 硬编码的测试环境 URL；
- 未来如需接入真实后端环境，建议在单独的配置文件中集中管理 API 根地址，并通过环境变量或构建模式区分测试 / 生产环境。

## 8. project.config.json 中 appid 检查

读取 `worker_house/project.config.json`，关键字段如下：

```json
{
  "miniprogramRoot": "dist/",
  "projectname": "taro_template",
  "description": "taro_template",
  "appid": "touristappid",
  "compileType": "miniprogram",
  "simulatorType": "wechat"
}
```

结论：

- 当前 `appid` 为占位符 `"touristappid"`；
- 上线前 **必须** 将其替换为真实的小程序 AppID；
- 替换后重新执行 `npm run build:weapp`，以便在 `dist/project.config.json` 中也写入正确的 appid，方便微信开发者工具导入与上传。 

本次任务按要求未对 `project.config.json` 做任何修改，仅做检查与提示。

## 9. 问题与建议

### 9.1 依赖 peer 冲突（webpack vs @tarojs/taro-loader）

- 现象：
  - `webpack` 当前版本为 `5.78.0`；
  - `@tarojs/taro-loader@4.1.9` 要求 `webpack@5.91.0` 作为 peerDependency；
  - 导致 `npm ci` / `npm install` 在默认模式下均出现 `ERESOLVE` 错误。

- 当前解决方案：
  - 通过 `npm install --legacy-peer-deps` 放宽 peer 依赖校验，成功安装依赖并完成构建；

- 后续建议：
  - 短期：在本地与 CI 中统一采用同样的安装命令，例如：

    ```bash
    npm install --legacy-peer-deps
    ```

    确保构建过程一致可复现；

  - 中长期：考虑将 `webpack` 升级至 `5.91.0`（或与 Taro 官方模板匹配的版本），并更新 lockfile，从根本上消除 peer 冲突。

### 9.2 appid 占位符替换

- 现状：`worker_house/project.config.json` 中 `appid` 为 `"touristappid"`，`dist/project.config.json` 同样会继承该值；
- 建议：
  - 在准备关联真实小程序账号时，将 `appid` 替换为正式 AppID；
  - 修改后重新执行构建命令，确保产物中的 `project.config.json` 同步更新；
  - 使用微信开发者工具导入 `dist/` 目录进行预览与真机调试。

### 9.3 Node 版本与 CI 一致性

- 现状：本次验证在 Node `v22.22.2` 环境下执行；
- 建议：
  - 若 CI 环境使用不同 Node 版本（如 18 LTS），建议在 CI 环境中再执行一次完整的依赖安装与构建，以验证兼容性；
  - 若希望尽量贴近 Taro 官方推荐，可考虑在本地与 CI 中统一使用 Node 18 LTS，并在必要时通过 AIME 环境管理工具切换 Node 版本。

## 10. 下一步上线建议

1. 在项目文档或 CI 配置中固定构建流程：

   - 安装依赖：`npm install --legacy-peer-deps`
   - 构建微信小程序：`npm run build:weapp`

2. 替换 `project.config.json` 中的 `appid` 为真实小程序 AppID 并重新构建。

3. 使用微信开发者工具导入 `dist/` 目录，进行：

   - 本地预览；
   - 真机调试；
   - （如需）后续结合 `miniprogram-ci` 实现自动化上传与发布（本次任务未执行任何 `miniprogram-ci` 操作，仅完成构建验证）。

---

### 步骤结果小结

- 环境检查：✅（Node / npm 版本满足 Taro 要求）
- 安装依赖：✅（通过 `npm install --legacy-peer-deps` 成功安装）
- 构建执行：✅（`npm run build:weapp` 构建成功）
- 产物校验：✅（已生成完整的微信小程序 `dist/` 目录，包含 `app.js`、`app.json`、`app.wxss` 等关键文件）
- 配置检查：✅（`appid` 为占位符需上线前替换，`config/index.ts` 与 `config/prod.ts` 未发现测试环境 URL 硬编码）
