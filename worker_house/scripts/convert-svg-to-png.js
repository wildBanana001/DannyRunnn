const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconsDir = path.join(__dirname, '../src/assets/icons');
const TARGET_SIZE = 81; // 微信 tabBar 推荐尺寸

// 仅转换 tabBar 使用到的 8 个图标
const iconBaseNames = [
  'home',
  'home-active',
  'activity',
  'activity-active',
  'treehole',
  'treehole-active',
  'profile',
  'profile-active'
];

async function convertOneIcon(baseName) {
  const svgPath = path.join(iconsDir, `${baseName}.svg`);
  const pngPath = path.join(iconsDir, `${baseName}.png`);

  if (!fs.existsSync(svgPath)) {
    console.warn(`[skip] SVG 不存在，跳过：${svgPath}`);
    return;
  }

  const svgBuffer = fs.readFileSync(svgPath);

  await sharp(svgBuffer)
    .resize(TARGET_SIZE, TARGET_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(pngPath);

  const stats = fs.statSync(pngPath);
  if (!stats.size) {
    throw new Error(`生成的 PNG 为空文件：${pngPath}`);
  }

  console.log(`[ok] ${baseName}.svg -> ${baseName}.png (${stats.size} bytes)`);
}

async function main() {
  console.log('开始将 tabBar SVG 图标转换为 81x81 PNG...');

  for (const name of iconBaseNames) {
    try {
      await convertOneIcon(name);
    } catch (err) {
      console.error(`[error] 转换 ${name} 失败：`, err.message || err);
      // 保留非零退出码，方便在 CI 中感知错误
      process.exitCode = 1;
    }
  }

  console.log('SVG -> PNG 转换完成');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[fatal] 转换脚本异常：', err);
    process.exit(1);
  });
}
