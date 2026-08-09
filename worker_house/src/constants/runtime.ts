/**
 * 小程序端公开运行配置。
 *
 * 这些值会随小程序一起发布，只能放非敏感信息。支付私钥、APIv3 密钥等
 * 服务端凭证必须继续保存在微信云托管的密钥/环境变量中。
 */
export const PAYMENT_API_MODE = 'cloudrun' as const; // 微信小程序固定使用真实云托管支付链路
export const CLOUD_ENV_ID = 'prod-d9g991lo4dba5a4da';
export const CLOUDRUN_SERVICE = 'worker-house-bff';
