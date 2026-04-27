const ci = require('miniprogram-ci');
const path = require('path');

(async () => {
  try {
    const project = new ci.Project({
      appid: 'wx06f0bff0bed0dc80',
      type: 'miniProgram',
      projectPath: path.join(__dirname, '../dist'),
      privateKeyPath: path.join(__dirname, '../.keys/private.wx06f0bff0bed0dc80.key'),
      ignores: ['node_modules/**/*'],
    });

    const uploadResult = await ci.upload({
      project,
      version: '1.0.0.30413',
      desc: '切到云托管 BFF + cloudrun 模式',
      setting: {
        es6: true,
        minify: true,
        minifyJS: true,
        minifyWXML: true,
        minifyWXSS: true,
      },
    });

    console.log('Upload success:', uploadResult);
  } catch (error) {
    console.error('Upload failed:', error);
    process.exit(1);
  }
})();
