import { config } from '../config.js';
import {
  formatMysqlOrderStorageError,
  getMysqlOrderStorageConfigurationIssues,
  migrateMysqlOrderStorage,
} from '../data/mysql-orders.js';

if (config.shopOrderStorage !== 'mysql') {
  throw new Error('迁移前请设置 SHOP_ORDER_STORAGE=mysql');
}

const issues = getMysqlOrderStorageConfigurationIssues();
if (issues.length > 0) {
  throw new Error(`MySQL 订单库配置不完整：${issues.join('、')}`);
}

try {
  await migrateMysqlOrderStorage();
  console.log('MySQL 订单表迁移完成');
} catch (error) {
  console.error(`MySQL 订单表迁移失败：${formatMysqlOrderStorageError(error)}`);
  process.exitCode = 1;
}
