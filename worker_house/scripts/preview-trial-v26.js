const ci = require('miniprogram-ci');
const fs = require('fs');
const path = require('path');

const project = new ci.Project({
  appid: 'wx06f0bff0bed0dc80',
  type: 'miniProgram',
  projectPath: path.resolve(__dirname, '..'),
  privateKeyPath: path.resolve(__dirname, '..', '.keys', 'private.wx06f0bff0bed0dc80.key'),
  ignores: ['node_modules/**/*'],
});

const desc = 'fix: DefinePlugin 兜底 TARO_APP_* 避免 process 残留';

const artifactsDir = path.resolve(__dirname, '..', 'artifacts');
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}
const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '');
const qrcodeOutputPath = path.resolve(artifactsDir, `preview-qr-fix-process-${timestamp}.jpg`);

ci
  .preview({
    project,
    desc,
    setting: {
      es6: false,
      es7: false,
      minify: true,
      autoPrefixWXSS: true,
    },
    qrcodeFormat: 'image',
    qrcodeOutputDest: qrcodeOutputPath,
    robot: 1,
    onProgressUpdate: console.log,
    pagePath: 'pages/home/index',
  })
  .then((res) => {
    const outputPath = path.resolve(artifactsDir, `preview-result-${timestamp}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(res, null, 2), 'utf8');
    console.log('PREVIEW SUCCESS:', JSON.stringify(res));
    console.log('QRCODE_SAVED:', qrcodeOutputPath);
    console.log('RESULT_SAVED:', outputPath);
  })
  .catch((err) => {
    console.error('PREVIEW FAILED:', err);
    process.exit(1);
  });
