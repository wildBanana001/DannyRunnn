// 从图片四边做 flood-fill，只清除"与边缘连通的浅色背景像素"
// 切图边缘背景色实测为米黄 ~rgb(250,249,231)，因此判定条件为：
//   三通道都 >= 200 且 通道差 < 40（排除偏色）
// 这样可以处理"米底黑字"按钮图：抠掉外部背景，但保留内部黑字
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..', 'src', 'assets');

const TARGETS = [
  // 黑底白字按钮图
  'home/text/btn-book-activity.png',
  'home/text/btn-join-community.png',
  'home/text/btn-explore-more.png',
  'home/text/btn-more-fun.png',
  'home/text/btn-space-story.png',
  'home/text/title-more-activities.png',
  // 白底字图（之前已处理过，再 floodfill 一次保证羽化更干净）
  'home/text/title-shechu-hero.png',
  'home/text/title-april-stories.png',
  'home/text/title-dream-english.png',
  'home/text/title-happy-house.png',
  'home/text/title-may-activities.png',
  'home/text/title-new-life-style.png',
  'home/text/title-owner.png',
  'home/text/title-shechu-stories.png',
  'home/text/label-orange.png',
  'home/text/label-xiaohei.png',
  'home/text/badge-lets-party.png',
];

// 浅色背景：每个通道都不低于 200，且 max-min 差值不超过 60（避免抠掉彩色）
function isLight(r, g, b) {
  if (r < 200 || g < 200 || b < 200) return false;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return (mx - mn) <= 60;
}

// 边缘羽化阈值
function isFeatherCandidate(r, g, b) {
  if (r < 170 || g < 170 || b < 170) return false;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return (mx - mn) <= 70;
}

async function processOne(rel) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) {
    console.log(`skip (not found) ${rel}`);
    return;
  }
  const { data, info } = await sharp(fp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const buf = Buffer.from(data);
  const visited = new Uint8Array(width * height);
  // BFS 队列，初始压入所有四边像素
  const stack = [];
  function push(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    stack.push(idx);
  }
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  let cleared = 0;
  let feathered = 0;
  while (stack.length) {
    const idx = stack.pop();
    const p = idx * 4;
    const r = buf[p], g = buf[p + 1], b = buf[p + 2];
    if (isLight(r, g, b)) {
      buf[p + 3] = 0;
      cleared++;
      const x = idx % width;
      const y = (idx / width) | 0;
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    } else if (isFeatherCandidate(r, g, b)) {
      // 边缘羽化：根据亮度等比降低 alpha
      const minC = Math.min(r, g, b);
      const a = Math.max(0, Math.round(((255 - minC) / (255 - 170)) * 255));
      buf[p + 3] = Math.min(buf[p + 3], a);
      feathered++;
    }
  }
  await sharp(buf, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(fp);
  console.log(`${rel}: cleared ${cleared} px, feathered ${feathered} px (${width}x${height})`);
}

(async () => {
  for (const t of TARGETS) {
    try {
      await processOne(t);
    } catch (err) {
      console.error('fail', t, err.message);
    }
  }
})();
