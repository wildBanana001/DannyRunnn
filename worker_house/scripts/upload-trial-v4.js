const ci = require('miniprogram-ci');
const fs = require('fs');
const path = require('path');

const project = new ci.Project({
  appid: 'wx06f0bff0bed0dc80',
  type: 'miniProgram',
  projectPath: path.resolve(__dirname, '..'), // worker_house 目录
  privateKeyPath: path.resolve(__dirname, '..', '.keys', 'private.wx06f0bff0bed0dc80.key'),
  ignores: ['node_modules/**/*'],
});

const version = '1.0.0.30447';
const desc = '社群二维码+便利贴+登录交互修复';

ci
  .upload({
    project,
    version,
    desc,
    setting: {
      es6: false, // 已经是 Taro 编译产物，不需要再转
      es7: false,
      minify: false, // 产物已压缩
      autoPrefixWXSS: false,
    },
    robot: 1,
    onProgressUpdate: console.log,
  })
  .then((res) => {
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '');
    const artifactsDir = path.resolve(__dirname, '..', 'artifacts');
    const outputPath = path.resolve(artifactsDir, `upload-result-${timestamp}.json`);

    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(res, null, 2), 'utf8');

    console.log('UPLOAD SUCCESS:', JSON.stringify(res));
    console.log('UPLOAD_RESULT_SAVED:', outputPath);
  })
  .catch((err) => {
    console.error('UPLOAD FAILED:', err);
    process.exit(1);
  });
