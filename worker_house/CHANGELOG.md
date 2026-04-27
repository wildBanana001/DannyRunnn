# CHANGELOG

## 2026-04-26

### worker_house v4 mock 闭环增强

- 新增统一业务类型出口 `src/types/index.ts`，补充活动、社畜档案、报名单、次卡订单、次卡使用记录等模型，并兼容历史字段。
- 重构 mock 会员态存储与服务：支持档案新增 / 编辑 / 删除 / 设默认，报名创建后写入报名列表与报名详情，购买次卡后即时刷新余量与使用记录。
- 活动详情页升级为 Swiper 轮播封面，并将报名入口切换到 `pages/register/` 三步流程。
- 新增 `pages/my-profiles/`、`pages/my-cards/`、`pages/registration-detail/` 页面，补齐“我的报名 / 我的档案 / 社畜次卡”闭环。
- 保留旧 `pages/registration/` 路径作为兼容跳转页，避免既有链接失效。
- 已执行 `npm run build:weapp`，构建通过；保留 1 条样式顺序 warning 与 1 条历史图片体积 warning。
