/**
 * 小程序端公开运行配置。
 *
 * 这些值会随小程序一起发布，只能放非敏感信息。支付私钥、APIv3 密钥等
 * 服务端凭证必须继续保存在微信云托管的密钥/环境变量中。
 */
export const CLOUD_ENV_ID = process.env.TARO_APP_CLOUD_ENV_ID?.trim() || '';
export const CLOUDRUN_SERVICE = process.env.TARO_APP_CLOUDRUN_SERVICE?.trim() || '';
