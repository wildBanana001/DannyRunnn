const ci = require('miniprogram-ci');
const fs = require('fs');
const path = require('path');

const projectPath = path.resolve(__dirname, '..');
const packageJson = readJson(path.join(projectPath, 'package.json'));
const projectConfig = readJson(path.join(projectPath, 'project.config.json'));
const action = normalizeAction(process.argv[2]);
const appid = readEnv('WECHAT_MINIPROGRAM_APPID') || projectConfig.appid;
const robot = readRobot(readEnv('WECHAT_MINIPROGRAM_ROBOT') || '1');
const artifactsDir = path.resolve(
  projectPath,
  readEnv('WECHAT_MINIPROGRAM_ARTIFACTS_DIR') || 'artifacts/ci',
);
const miniprogramRoot = path.resolve(projectPath, projectConfig.miniprogramRoot || 'dist');
const version = buildVersion();
const desc = buildDescription();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readEnv(name) {
  return process.env[name]?.trim() || '';
}

function normalizeAction(value = 'all') {
  const aliases = {
    'upload-and-preview': 'all',
    all: 'all',
    preview: 'preview',
    upload: 'upload',
    validate: 'validate',
  };
  const normalized = aliases[value];
  if (!normalized) {
    throw new Error(`未知操作 ${value}，可选值：validate / upload / preview / all`);
  }
  return normalized;
}

function readRobot(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) {
    throw new Error('WECHAT_MINIPROGRAM_ROBOT 必须是 1 到 30 的整数');
  }
  return parsed;
}

function sanitizeVersion(value) {
  return value.replace(/[^0-9A-Za-z._-]/g, '-').slice(0, 64);
}

function buildVersion() {
  const configured = readEnv('WECHAT_MINIPROGRAM_VERSION');
  if (configured) {
    return sanitizeVersion(configured);
  }

  const runNumber = readEnv('GITHUB_RUN_NUMBER');
  const runAttempt = readEnv('GITHUB_RUN_ATTEMPT');
  const localBuildId = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const buildId = runNumber
    ? `${runNumber}${runAttempt && runAttempt !== '1' ? `.${runAttempt}` : ''}`
    : localBuildId;

  return sanitizeVersion(`${packageJson.version || '0.0.0'}.${buildId}`);
}

function buildDescription() {
  const configured = readEnv('WECHAT_MINIPROGRAM_DESC');
  const commit = readEnv('GITHUB_SHA').slice(0, 7);
  return (configured || `CI ${commit || 'local'} 开发版本`).replace(/\s+/g, ' ').slice(0, 50);
}

function getCredential() {
  const privateKey = process.env.WECHAT_MINIPROGRAM_PRIVATE_KEY?.trim();
  if (privateKey) {
    return {
      privateKey: privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey,
      source: 'environment',
    };
  }

  const privateKeyPath = readEnv('WECHAT_MINIPROGRAM_PRIVATE_KEY_PATH')
    || path.join(projectPath, '.keys', `private.${appid}.key`);
  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(
      '缺少微信代码上传密钥：请配置 WECHAT_MINIPROGRAM_PRIVATE_KEY，'
      + '或 WECHAT_MINIPROGRAM_PRIVATE_KEY_PATH',
    );
  }

  return { privateKeyPath, source: 'file' };
}

function validateBuild() {
  if (!appid) {
    throw new Error('project.config.json 或 WECHAT_MINIPROGRAM_APPID 中缺少 AppID');
  }
  if (projectConfig.appid && projectConfig.appid !== appid) {
    throw new Error(`AppID 不一致：project.config.json=${projectConfig.appid}，CI=${appid}`);
  }
  if (!fs.existsSync(path.join(miniprogramRoot, 'app.json'))) {
    throw new Error(`未找到 ${path.join(miniprogramRoot, 'app.json')}，请先执行 npm run build:weapp`);
  }
}

function progress(info) {
  if (!info) return;
  if (typeof info !== 'object') {
    console.log('[miniprogram-ci]', info);
    return;
  }

  const message = info.message || info.status;
  if (message && (info.status === 'done' || !info.status)) {
    console.log(`[miniprogram-ci] ${message}`);
  }
}

function writeJson(fileName, value) {
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(
    path.join(artifactsDir, fileName),
    JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item), 2),
    'utf8',
  );
}

function writeStepSummary(manifest) {
  const summaryPath = readEnv('GITHUB_STEP_SUMMARY');
  if (!summaryPath) return;

  const lines = [
    '### 微信小程序开发版本',
    '',
    `- AppID：\`${manifest.appid}\``,
    `- 版本：\`${manifest.version}\``,
    `- CI 机器人：\`${manifest.robot}\``,
    `- Commit：\`${manifest.commit || 'local'}\``,
    `- 开发版本上传：${manifest.uploaded ? '成功' : '未执行'}`,
    `- 预览二维码：${manifest.previewed ? '已生成到工作流产物' : '未执行'}`,
    '',
  ];
  fs.appendFileSync(summaryPath, lines.join('\n'), 'utf8');
}

async function main() {
  validateBuild();

  if (action === 'validate') {
    console.log(JSON.stringify({ action, appid, miniprogramRoot, version, robot }, null, 2));
    return;
  }

  const credential = getCredential();
  const project = new ci.Project({
    appid,
    type: 'miniProgram',
    projectPath,
    ...(credential.privateKey ? { privateKey: credential.privateKey } : { privateKeyPath: credential.privateKeyPath }),
    ignores: ['node_modules/**/*', '.git/**/*', '.keys/**/*', 'artifacts/**/*'],
  });
  const manifest = {
    appid,
    version,
    desc,
    robot,
    commit: readEnv('GITHUB_SHA'),
    generatedAt: new Date().toISOString(),
    uploaded: false,
    previewed: false,
  };

  console.log(`[miniprogram-ci] action=${action} version=${version} robot=${robot} key=${credential.source}`);

  if (action === 'upload' || action === 'all') {
    const uploadResult = await ci.upload({
      project,
      version,
      desc,
      robot,
      setting: { useProjectConfig: true },
      onProgressUpdate: progress,
    });
    manifest.uploaded = true;
    writeJson('upload-result.json', uploadResult);
  }

  if (action === 'preview' || action === 'all') {
    const qrcodeOutputDest = path.join(artifactsDir, 'preview-qrcode.jpg');
    fs.mkdirSync(artifactsDir, { recursive: true });
    const previewResult = await ci.preview({
      project,
      desc,
      robot,
      setting: { useProjectConfig: true },
      qrcodeFormat: 'image',
      qrcodeOutputDest,
      pagePath: readEnv('WECHAT_MINIPROGRAM_PREVIEW_PAGE') || 'pages/home/index',
      onProgressUpdate: progress,
    });
    manifest.previewed = true;
    writeJson('preview-result.json', previewResult);
  }

  writeJson('manifest.json', manifest);
  writeStepSummary(manifest);
  console.log('[miniprogram-ci] 完成，结果目录：', artifactsDir);
}

main().catch((error) => {
  const serializedError = {
    action,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    generatedAt: new Date().toISOString(),
  };
  try {
    writeJson('failure.json', serializedError);
  } catch (_writeError) {
    // 保留原始错误作为退出原因。
  }
  console.error('[miniprogram-ci] 失败：', serializedError.message);
  process.exitCode = 1;
});
