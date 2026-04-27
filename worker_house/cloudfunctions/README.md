# 云函数部署说明

1. 在微信开发者工具中打开 `worker_house` 项目，确认 `project.config.json` 已包含 `cloudfunctionRoot: "cloudfunctions/"`。
2. 将 `src/cloud/index.ts` 中的 `YOUR_CLOUD_ENV_ID` 替换成你的云开发环境 ID。
3. 依次右键上传并部署以下云函数：`poster`、`activity`、`post`、`site_config`、`admin_auth`、`_seed`。
4. 首次部署后，先在云数据库中创建集合：`posters`、`activities`、`posts`、`comments`、`site_config`、`admins`。
5. 执行 `_seed` 云函数进行种子数据初始化。该函数会先清空上述业务集合再重写入，适合开发环境重复执行。
6. 若需要管理后台能力，请在 `admins` 集合中写入管理员账号，字段至少包含 `username`、`password`、`token`。开发默认 token 为 `worker-house-admin-token`。
7. `site_config` 集合建议保留单条记录，前端默认读取第一条数据作为站点配置。
