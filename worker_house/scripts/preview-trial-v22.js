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

const desc = '公众号跳转优化 + gh_05290805c002 关联提示';

const artifactsDir = path.resolve(__dirname, '..', 'artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '');
const qrcodeOutputPath = path.resolve(artifactsDir, `preview-qr-${timestamp}.jpg`);

ci
  .preview({
    project,
    desc,
    setting: {
      es6: false,
      es7: false,
      minify: false,
      autoPrefixWXSS: false,
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
