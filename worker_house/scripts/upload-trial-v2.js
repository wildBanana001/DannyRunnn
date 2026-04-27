const ci = require('miniprogram-ci');
const path = require('path');

const project = new ci.Project({
  appid: 'wx06f0bff0bed0dc80',
  type: 'miniProgram',
  projectPath: path.resolve(__dirname, '..'),     // worker_house 目录
  privateKeyPath: path.resolve(__dirname, '..', '.keys', 'private.wx06f0bff0bed0dc80.key'),
  ignores: ['node_modules/**/*'],
});

const version = '1.0.0.30427';
const desc = '图片URL修复+微信授权登录+Mine页个人信息';

ci.upload({
  project,
  version,
  desc,
  setting: {
    es6: false,          // 已经是 Taro 编译产物，不需要再转
    es7: false,
    minify: false,       // 产物已压缩
    autoPrefixWXSS: false,
  },
  robot: 1,
  onProgressUpdate: console.log,
}).then((res) => {
  console.log('UPLOAD SUCCESS:', JSON.stringify(res));
}).catch((err) => {
  console.error('UPLOAD FAILED:', err);
  process.exit(1);
});
