const ci = require('miniprogram-ci')
const path = require('path')

async function main() {
  const project = new ci.Project({
    appid: 'wx06f0bff0bed0dc80',
    type: 'miniProgram',
    projectPath: path.resolve(__dirname, '..'),
    privateKeyPath: path.resolve(__dirname, '../.keys/private.wx06f0bff0bed0dc80.key'),
    ignores: ['node_modules/**/*']
  })
  const uploadResult = await ci.upload({
    project,
    version: '1.0.0.30416',
    desc: '主包瘦身：pastActivities 改为 API 拉取',
    setting: { es6: true, es7: true, minify: true, codeProtect: false },
    onProgressUpdate: console.log,
  })
  console.log('uploadResult', uploadResult)
}
main().catch(e => { console.error(e); process.exit(1) })
