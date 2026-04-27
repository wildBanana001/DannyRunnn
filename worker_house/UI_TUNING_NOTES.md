# UI / 体验优化记录

## 本轮目标

围绕 `worker_house` 小程序完成一轮视觉与体验升级，重点包括首页海报开屏、活动图片比例统一、留言墙交互修复与搜索/标签能力、个人中心功能补全。

## 1. 首页与活动视觉优化

- 首页顶部海报轮播改为更强的开屏样式，轮播区提升到约 `70vh`，左右留出大白边，卡片圆角与轻阴影同步增强。
- 自定义底部圆点指示器，普通态为克制灰色，当前态切换为主色 `#E63946`。
- 自动轮播节奏调整为 4.5 秒，同时保留手动滑动能力。
- 首页新增“近期活动”板块，活动封面统一改为 `4:3` 比例，文案与留白更接近手账感节奏。
- 活动 Tab 页中的进行中卡片、已结束卡片缩略图，以及活动详情页顶部封面统一改为 `4:3` 展示，全部使用 `aspectFill` 裁切。

## 2. 留言墙能力补全

- 帖子模型新增 `title` 字段，发帖页支持填写标题。
- 发帖页标签能力改为预设多选：`日常 / 吐槽 / 心事 / 求助 / 分享 / 活动 / 推荐 / 其他`，最多可选 3 个。
- 留言墙列表卡片新增标题与标签展示，超出标签数量时以 `...` 收口。
- 留言墙顶部新增搜索框，支持按 `标题 + 内容 + 标签` 前端过滤，输入做了 `300ms debounce`。
- 留言详情弹层改为底部抽屉样式，增加拖拽条、向上弹出动画、向下拖拽超过 `150rpx` 自动关闭。
- 弹层正文区域改为固定高度 `ScrollView`，修复打开后内容无法滚动的问题。
- 独立帖子详情页同步切换到新模型，改为通过 `cloud/services` 读取详情、点赞和评论。

## 3. 个人中心补功能

- “我的”页改为真实导航入口，不再只弹 Toast。
- 新增页面：
  - `pages/my-registrations/`
  - `pages/my-posts/`
  - `pages/my-favorites/`
  - `pages/my-addresses/`
  - `pages/address-edit/`
  - `pages/settings/`
- 新增 `src/mocks/profile.ts` 作为个人中心 mock 数据源，补充报名记录、我的帖子、收藏内容与地址数据。
- 地址管理完成新增 / 编辑 / 删除 / 默认地址切换；列表页删除增加二次确认。
- 设置页补充清缓存、关于我们、退出登录逻辑。
- 当前项目内没有独立登录页，因此退出登录后会回到“我的”页的未登录态，并提供“去登录”按钮作为登录壳入口。

## 4. 数据与类型同步

- 小程序端 `Post` / `PostCreateParams` 增加 `title`，保留并强化 `tags` 字段。
- 云函数 `cloudfunctions/post` 创建帖子时同步写入 `title` 与 `tags`。
- `worker_house_bff` 的帖子类型与标准化逻辑补充 `title` 映射，并让列表关键字搜索同时覆盖标题、正文和标签。
- 管理后台原本已支持标签列展示，本轮未额外改动后台页面。

## 5. 验证结果

- 已执行 `standard-lint`，通过。
- 已执行 `npx @byted/tsc-files-mono ...`，通过。
- 已执行 `npm run build:weapp`，构建通过。
- 构建阶段仅保留一个已有资源体积提醒：`assets/illustrations/empty.png` 体积约 `1.05 MiB`，不影响本次构建通过。

## 6. 第二轮 UI 调优（v2）

- 首页海报轮播改为沉浸式全屏开场：去掉所有叠加文案与阴影，轮播图宽度铺满屏幕，顶部贴近状态栏，仅保留底部圆角与点击跳转逻辑。
- 首页海报数据在渲染层固定插入第 0 项 `particle-slogan` Banner，文案为“社畜没有派对”，不依赖运营配置，也不会被运营删除。
- 新增 `src/components/ParticleBanner/`，使用 `Canvas type="2d"` + `requestAnimationFrame` 绘制宇宙粒子背景，并在 Banner 不可见或切出当前轮播项时暂停动画，避免无效渲染。
- 新增 `src/components/AdaptiveCover/`，统一活动封面展示策略：默认保留 `4:3` 占位，接近 `4:3` 的图片继续裁切展示，比例差异大的图片自动改为按原比例展开，背景色统一为 `#F7F6F2`。
- 活动 Tab、首页近期活动、往期活动列表、活动详情顶部封面全部切换到 `AdaptiveCover`，避免竖图、宽图被强裁切。
- 留言墙详情抽屉改为 `100vw` 自适应布局，正文与底部操作区统一使用 `32rpx` 横向留白，内容区开启 `box-sizing: border-box`，并在大屏设备下限制 `max-width: 750rpx` 居中显示。

## 7. 第二轮验证结果（v2）

- 已执行 `npm install --legacy-peer-deps`，依赖检查通过；首次普通 `npm install` 因 Taro `webpack` peer 版本冲突失败，已按兼容参数完成安装。
- 已执行 `standard-lint`，通过。
- 已执行 `npx @byted/tsc-files-mono ...`，通过。
- 已执行 `npm run build:weapp`，构建通过。
- 已执行 `node scripts/preview.js`，预览二维码已更新到 `worker_house/preview-qrcode.jpg`。
- 构建阶段仍保留一个历史资源体积提醒：`assets/illustrations/empty.png` 约 `1.05 MiB`，不影响本次构建与预览。

## 8. 第三轮 UI 调优（v3）

- 首页整体切换为纯白简约风：`src/pages/home/index.tsx` 与 `src/pages/home/index.module.scss` 去掉米色底、卡片阴影、外壳背景和装饰性英文 kicker，改为白底直铺内容、大留白分段和更克制的字号层级。
- Banner 继续保留 `ParticleBanner` 主视觉，Banner 以下的近期活动、视频动态、空间一角、主理人全部改为无卡片外壳结构；活动封面仍保留 `AdaptiveCover` 的 `4:3` 自适应逻辑，只保留图片圆角与下方文字信息。
- 首页视频区升级为 3 条 mock 视频列表，新增 `HomeVideo` 类型与 `siteConfig.videos` 数据结构，点击后优先调用 `openChannelsEvent` / `openChannelsUserProfile` 打开对应视频号，当前 `finderUserName` 使用占位数据，后续可由后台替换。
- 新增可复用组件 `src/components/BottomSheet/`，留言详情弹层切换为标准 `70vh` BottomSheet：`100vw` 铺满、`280ms ease-out` 动画、半透明黑色蒙层、顶部拖拽条、点击蒙层关闭与下拉超过 `150rpx` 关闭。
- `src/pages/wall/components/PostModal.tsx` 基于 BottomSheet 重构，正文区与评论区改为稳定的 `ScrollView` + 底部输入栏结构，并补充安全区 padding 处理。
- “我的”页移除“我的收藏”入口与收藏统计，删除 `pages/my-favorites/` 页面注册与目录；留言详情、留言卡片、独立帖子详情中的心形按钮统一降级为 Toast 占位“已收藏”，不再做真实存储。

## 9. 第三轮验证结果（v3）

- 已执行 `npm install --legacy-peer-deps`，依赖状态正常。
- 已执行 `standard-lint`，通过。
- 已执行 `npx @byted/tsc-files-mono ...`，通过。
- 已执行 `npm run build:weapp`，构建通过。
- 按要求仅完成 build，本轮未执行 upload。
- 构建阶段仍保留一个历史资源体积提醒：`assets/illustrations/empty.png` 约 `1.05 MiB`，不影响本次构建通过。

## 10. 第四轮闭环增强（v4）

- 在 `src/types/index.ts` 新增统一类型出口，补齐 `Activity / Profile / Registration / CardOrder / CardUsageLog` 等核心模型；兼容历史 `coverImage / gallery / UserRegistration` 结构，并补充 `cover / covers / cardEligible` 字段。
- `src/data/activities.ts` 全量补充活动轮播图 `covers`、主封面 `cover` 与是否支持次卡 `cardEligible`，同时保留既有活动字段，确保首页、活动列表、详情页仍按原风格运行。
- 新增本地 mock 状态存储 `src/data/mock-member.ts`，在 mock 模式下预置：1 条默认社畜档案、1 张 active 次卡（剩余 2 次）、1 条次卡使用记录、2 条报名记录；并支持前端侧对档案、报名、次卡的实时新增 / 编辑 / 删除 / 设默认 / 购买 / 报名后状态刷新。
- 新增 `src/services/member.ts`，沿用现有 `request` 封装，对 `mock / bff / cloudrun` 三种模式统一提供 profile / registration / card 服务能力；原有 `fetchActivities / fetchActivityDetail` 仍保留并补充活动字段标准化。
- 活动详情页顶部封面改为 `Swiper` 轮播，数据源优先使用 `activity.covers`，空时回退 `[activity.cover]`，开启 `indicatorDots / autoplay / circular / 3500ms`，并支持点击预览原图。
- 新增 `pages/register/` 三段式报名流程：选档案 → 新建/编辑档案 → 确认订单；表单抽离到 `src/components/ProfileForm/`，字段顺序、文案与可选项全部按需求落地；旧 `pages/registration/` 改为兼容跳转页，保留路径但统一导向新流程。
- 确认订单页接入次卡抵扣公式：`if (!useCard || !cardEligible || remaining <= 0) return 0; return Math.min(price, 148);`；同步展示原价、抵扣、实付，以及不支持次卡时的禁用提示。
- “我的”页新增 `我的档案 / 社畜次卡` 入口，并把统计改为动态读取 mock 服务；新增 `pages/my-profiles/`、`pages/my-cards/`、`pages/registration-detail/`，完善报名详情、档案管理与次卡购买/记录闭环。
- `pages/my-registrations/` 改为真实读取报名服务，展示封面、标题、状态、实付金额、报名时间，并可跳转查看报名快照和支付信息。

## 11. 第四轮验证结果（v4）

- 已执行 `npm run build:weapp`，构建通过。
- 构建阶段新增 1 条历史性的样式顺序 warning：`Button` 与 `BottomSheet` 的样式在 `pages/my-profiles/index` 与 `pages/wall/index` 间出现 `mini-css-extract-plugin` 顺序提示，但不影响产物生成与运行。
- 构建阶段仍保留一个历史资源体积提醒：`assets/illustrations/empty.png` 约 `1.05 MiB`，不影响本轮 mock 闭环功能。

## 12. 第五轮 UI 改造（v5）

- 首页 `src/pages/home/` 按品牌落地页方式重做：整体切换为纯白底 + 纯黑字 + 手绘线稿装饰，原首页的运营海报轮播、活动卡片、视频小卡片、空间一角与旧版主理人布局全部下线，改为“首屏主视觉 → 四真理念 → 品牌起源 → 空间轮播 → 动态视频 → 主理人”六段式沉浸滚动结构。
- 新增 `src/components/Doodle/`、`src/components/CrossFadeGallery/`、`src/components/HomeStickyActions/` 与 `src/assets/home/` 占位素材，首页通过 SVG 手绘圆圈 / 箭头 / 星星 / 波浪线构建黑白品牌感；首屏标题暂用系统字体模拟艺术字，并在源码中保留后续替换 SVG 的 TODO。
- `src/data/site.ts` 补充首页品牌数据：`heroImage / heroSlogan / originTitle / originParagraphs / spaceGallery / manifestoItems / noList / communityQr`；`src/data/posters.ts` 同步整理为空间展示与首页画面可复用的 mock 图集。
- 首页新增固定底部双按钮「预约活动 / 加入社群」：首屏至第二屏常驻，滚动超过约 `2 * windowHeight` 后淡出隐藏；预约活动保持原有 Tab 跳转逻辑，加入社群改为打开二维码 BottomSheet。
- 留言墙 BottomSheet 关闭体验修复：`src/components/BottomSheet/` 改为隐藏态保留 DOM、关闭时只保留抽屉位移动画、不再同步淡出蒙层；同时增加合成层隔离与 `catchMove`，避免关闭后底层页面出现闪烁 / 抖动 / 滚动穿透。`src/pages/wall/components/PostModal.tsx` 额外缓存最近一次帖子内容，隐藏后不立即卸载，减少关闭瞬间 ScrollView 重置带来的视觉抖动。

## 13. 第五轮验证结果（v5）

- 已执行 `npm install --legacy-peer-deps`，依赖状态正常，无新增安装报错。
- 已执行 `standard-lint`，通过。
- 已执行 `npx @byted/tsc-files-mono ...`，通过。
- 已执行 `npm run build:weapp`，构建通过。
- 本轮按要求未执行 upload，也未进行 git commit。
- 构建阶段仍保留既有 warning：`BottomSheet` 与 `Button` 的样式顺序提示，以及历史资源 `assets/illustrations/empty.png` 体积约 `1.05 MiB`；均不影响本次产物生成。
