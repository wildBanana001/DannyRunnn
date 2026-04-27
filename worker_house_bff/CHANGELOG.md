# Changelog

## 2026-04-26

- 新增统一类型模型：在 `src/types/index.ts` 补齐并导出 `Activity`、`Profile`、`Registration`、`CardOrder`、`CardUsageLog` 等核心类型，活动模型兼容原有字段并新增 `cover` / `covers` / `cardEligible`。
- 新增内存数据层：在 `src/data/` 下补充 `profiles.ts`、`registrations.ts`、`cardOrders.ts`、`activities.ts` 以及共享 `seed.ts` / `store.ts`，用于后续真联调前的 mock 数据承载。
- 新增用户侧接口：补齐 `/api/profiles`、`/api/registrations`、`/api/card-orders` RESTful 路由，支持用户档案、报名记录、次卡订单与次卡使用日志。
- 新增管理后台接口：补齐 `/api/admin/registrations` 与 `/api/admin/card-orders`，可通过 Bearer Token 直接读取 mock 数据。
- 调整鉴权兼容性：用户侧基于 `X-WX-OPENID` 识别当前用户；管理侧兼容 `Authorization: Bearer admin-token` 与现有默认 token 逻辑。
- 报名逻辑新增后端结算：创建 registration 时由后端统一计算 `originalPrice` / `cardOffset` / `payable`，并在满足条件时自动扣减次卡剩余次数、生成 usage log。
