const ci = require('miniprogram-ci');
const path = require('path');

(async () => {
  try {
    const project = new ci.Project({
      appid: 'wx06f0bff0bed0dc80',
      type: 'miniProgram',
      projectPath: path.resolve(__dirname, '..'), // 指向 worker_house 根目录
      privateKeyPath: path.resolve(
        __dirname,
        '../.keys/private.wx06f0bff0bed0dc80.key'
      ),
      ignores: ['node_modules/**/*'],
    });

    console.log('[CI] Upload start:', new Date().toISOString());
    const start = Date.now();

    const uploadResult = await ci.upload({
      project,
      version: '1.0.0',
      desc: '首次发布 - 体验版',
      robot: 1,
      setting: {
        es6: true,
        es7: true,
        minify: true,
        codeProtect: false,
        autoPrefixWXSS: true,
      },
      onProgressUpdate: console.log,
    });

    const durationMs = Date.now() - start;
    console.log('[CI] Upload done in', durationMs, 'ms');
    console.log('UPLOAD_DURATION_MS:', durationMs);
    console.log('UPLOAD_RESULT:', JSON.stringify(uploadResult, null, 2));
  } catch (err) {
    console.error('UPLOAD_FAILED:', err);
    process.exit(1);
  }
})();
