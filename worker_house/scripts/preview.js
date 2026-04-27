/* eslint-disable */
const ci = require('miniprogram-ci')
const path = require('path')

async function main() {
  const project = new ci.Project({
    appid: 'wx06f0bff0bed0dc80',
    type: 'miniProgram',
    projectPath: path.resolve(__dirname, '..'),
    privateKeyPath: path.resolve(__dirname, '../.keys/private.wx06f0bff0bed0dc80.key'),
    ignores: ['node_modules/**/*'],
  })

  const qrcodeOutputDest = path.resolve(__dirname, '../preview-qrcode.jpg')

  const previewResult = await ci.preview({
    project,
    desc: '复古手账风 preview',
    setting: { es6: true, es7: true, minify: true, codeProtect: false },
    qrcodeFormat: 'image',
    qrcodeOutputDest,
    pagePath: 'pages/home/index',
    onProgressUpdate: (info) => {
      // 避免日志过多，只打印关键信息
      if (info && typeof info === 'object') {
        console.log('[progress]', info.message || JSON.stringify(info))
      } else {
        console.log('[progress]', info)
      }
    },
  })

  console.log('=== preview done ===')
  console.log('qrcode saved to:', qrcodeOutputDest)
  console.log('previewResult:', JSON.stringify(previewResult, null, 2))
}

main().catch((e) => {
  console.error('=== preview failed ===')
  console.error(e && e.message ? e.message : e)
  if (e && e.stack) console.error(e.stack)
  process.exit(1)
})
