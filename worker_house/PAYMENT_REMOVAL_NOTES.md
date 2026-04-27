# PAYMENT_REMOVAL_NOTES

本文件记录 2026-04-26 由 Aime 帮助移除支付能力时对仓库进行的改动，方便后续回滚或排查。

## 小程序（worker_house）

1. 新增主理人微信号常量
   - 新增文件 `src/constants/contact.ts`，导出：
     - `OWNER_WECHAT = 'DannyRunnn'`
     - `OWNER_WECHAT_TIP`：提示文案「请添加主理人微信 DannyRunnn，完成缴费后即视为报名成功 🎉」。

2. 报名页改造
   - 文件：`src/pages/registration/index.tsx`
     - 报名成功后不再跳转支付，只调用 `submitActivitySignup` 写入报名记录。
     - 新增报名成功弹窗：
       - 展示主理人微信号 `DannyRunnn`；
       - 「复制微信号」按钮：调用 `Taro.setClipboardData`，成功后 Toast「微信号已复制」；
       - 提示文案使用 `OWNER_WECHAT_TIP`；
       - 「我知道了」按钮：关闭弹窗并 `Taro.navigateBack()`。
     - 报名页顶部活动卡价格文案改为：
       - `费用：¥XXX（加微信缴费）`。
   - 样式：`src/pages/registration/index.module.scss`
     - 新增 `.successOverlay`、`.successModal` 等样式，用 #E63946 / #F7F6F2 / #3E2C1C 配色实现结果弹窗。

3. 活动详情页价格展示调整
   - 文件：`src/pages/activity-detail/index.tsx`
     - 价格卡片文案由「报名费用」改为「活动费用（元）」。
     - 价格行改为：「费用：¥XXX（加微信缴费）」并保留原价划线显示。
   - 样式：`src/pages/activity-detail/index.module.scss`
     - 新增 `.priceHint` 用于「（加微信缴费）」提示。

4. 个人中心支付相关 UI 调整
   - 文件：`src/pages/profile/index.tsx`
     - 首页菜单移除「支付记录」入口，仅保留「我的报名 / 我的帖子 / 我的收藏 / 地址管理 / 设置」。
     - 「最近报名」卡片中的金额展示改为：
       - `费用：¥XXX（加微信缴费）`。
   - 文件：`src/utils/helpers.ts`
     - 报名状态文案 `getRegistrationStatusText` 调整为线下缴费语义：
       - `pending` → 「待加微信缴费」
       - `paid` → 「待线下确认」
       - `confirmed` → 「已报名成功」
       - `cancelled` 保持「已取消」。
   - 类型调整：
     - 删除 `src/types/activity.ts` 中未使用的 `ActivityRegistration` 接口（原包含支付金额、支付时间、交易号等字段）。

5. 云函数报名记录结构调整
   - 文件：`cloudfunctions/activity/index.js`
     - `signup` 分支中报名记录结构从：
       - `{ nickname, phone, wechatId, createdAt }`
       改为：
       - `{ activityId, nickname, phone, wechatId, status: 'pending_payment_offline', createdAt }`
     - 仅用于记录报名信息，不再涉及任何支付字段或支付状态。
   - 种子数据：
     - `cloudfunctions/_seed/index.js` 中 `activities`、`site_config` 等示例数据本身不包含支付单号/支付状态，本次未修改。

## 管理后台（worker_house_admin）

1. 活动表单中的价格字段文案
   - 文件：`src/pages/Activity/Edit.tsx`
     - 将活动编辑表单中费用字段的 label 从「价格」改为「活动费用（元）」。
     - 仍然保留 `price` / `originalPrice` 字段，用于小程序端展示费用，不再驱动任何支付流程。

2. 支付相关类型清理
   - 文件：`src/types/activity.ts`
     - 删除未使用的 `ActivityRegistration` 接口（原包含支付状态、支付金额、支付时间、交易号等字段），避免误用为在线支付模型。

## BFF（worker_house_bff）

- 文件：`src/mock/types.ts`
  - 为 `ActivitySignupRecord` 增加可选字段 `status?: string`，用于与云函数中报名记录的 `status: 'pending_payment_offline'` 对齐。
  - BFF 现有路由中未实现支付相关接口（经搜索无 `payment` / `order` 相关逻辑），本次未删除任何路由或内存 DB 结构。

## 说明

- 全工程内不存在 `requestPayment` / `wx.requestPayment` 调用，本次改动后仍保持为 0。
- 所有改动均为「报名 → 记录信息 → 展示主理人微信号 / 提示加微信缴费」的线下缴费模式，不再触发任何在线支付流程。
- 如需回滚到含支付字段的模型，可参考本文件中提到的路径，补回 `ActivityRegistration` 类型定义和原有状态文案。
