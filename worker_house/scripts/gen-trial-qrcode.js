const ci = require('miniprogram-ci');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env.local'),
});

const version = process.argv[2] || '1.0.0.30623';
const desc = process.argv[3] || `${version} 预览二维码`;
const buildNo = version.split('.').pop();

async function main() {
  const project = new ci.Project({
    appid: 'wx06f0bff0bed0dc80',
    type: 'miniProgram',
    projectPath: path.resolve(__dirname, '..'),
    privateKeyPath: path.resolve(
      __dirname,
      '..',
      '.keys',
      'private.wx06f0bff0bed0dc80.key',
    ),
    ignores: ['node_modules/**/*'],
  });

  const artifactsDir = path.resolve(__dirname, '..', 'artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const qrcodeOutputPath = path.resolve(
    artifactsDir,
    `trial-qrcode-${buildNo}.png`,
  );
  const resultOutputPath = path.resolve(
    artifactsDir,
    `trial-qrcode-${buildNo}-preview-result.json`,
  );

  console.log(`[preview] generating trial qrcode for ${version}`);
  console.log('[preview] qrcodeOutputPath:', qrcodeOutputPath);

  const baseOptions = {
    project,
    desc,
    setting: {
      es6: true,
      es7: true,
      minify: true,
      codeProtect: false,
      autoPrefixWXSS: true,
    },
    qrcodeFormat: 'image',
    qrcodeOutputDest: qrcodeOutputPath,
    pagePath: 'pages/home/index',
    searchQuery: '',
    scene: 1011,
    onProgressUpdate: console.log,
  };

  let previewResult;
  let lastError;

  for (const robot of [1, 2]) {
    try {
      console.log(`[preview] calling ci.preview with robot=${robot}`);
      previewResult = await ci.preview({
        ...baseOptions,
        robot,
      });
      console.log(`[preview] ci.preview success with robot=${robot}`);
      lastError = undefined;
      break;
    } catch (err) {
      lastError = err;
      console.error(
        `[preview] ci.preview failed with robot=${robot}:`,
        err && err.message ? err.message : err,
      );
    }
  }

  if (!previewResult) {
    throw lastError || new Error('ci.preview 调用失败，未返回结果');
  }

  console.log('[preview] converting qrcode image to PNG (in-place via temp file)...');
  const tmpPngPath = `${qrcodeOutputPath}.tmp`;
  await sharp(qrcodeOutputPath).png().toFile(tmpPngPath);
  fs.renameSync(tmpPngPath, qrcodeOutputPath);
  console.log('[preview] qrcode converted to PNG.');

  fs.writeFileSync(resultOutputPath, JSON.stringify(previewResult, null, 2), 'utf8');
  console.log('[preview] result saved to:', resultOutputPath);
  console.log('[preview] qrcode saved to:', qrcodeOutputPath);
}

main().catch((err) => {
  console.error('[preview] final error:', err && err.message ? err.message : err);
  console.error(
    '如果错误提示涉及 IP 白名单、robot 冲突或构建产物异常，请在微信公众平台 → 开发管理 → 开发设置中更新上传 IP 白名单，或在微信开发者工具中通过“版本管理 → 体验版”扫码体验当前版本。',
  );
  process.exit(1);
});
