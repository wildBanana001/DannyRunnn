/**
 * 当前所有 service 通过 MSW Mock 提供的 /api 接口进行本地开发。
 *
 * 未来若接入微信云开发，推荐采用 BFF（Backend For Frontend） 方案：
 * 1. 使用 Node.js（例如 Express）搭建一个中间层服务，将管理后台发起的 REST 请求转发到云函数 HTTP 触发器。
 * 2. 在该 BFF 中处理鉴权与会话管理，对前端保持统一的 REST 接口协议。
 * 3. 在 .env 中将 VITE_API_BASE_URL 替换为 BFF 地址，并关闭 MSW。
 *
 * 本文件作为后续接入云开发时的适配层占位，目前不包含具体实现。
 */
export {};
