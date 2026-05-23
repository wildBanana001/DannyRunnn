// 把指定目录下的【白底装饰图】白底转为透明（就地覆盖）
// 黑底字图、tabbar、icons 等不在范围内
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..', 'src', 'assets');

// 待处理白名单（路径相对 src/assets）
// 仅包含实际在页面里 import 使用的、白底字图/装饰图
const TARGETS = [
  // 首页字体切图
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
  // 装饰图
  'illustrations/tape.png',          // 留言墙 NoteCard 胶带
  'illustrations/avatar-frame.png',  // 我的页头像相框
];

const THRESHOLD = 240;

async function processOne(rel) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) {
    console.log(`skip (not found) ${rel}`);
    return;
  }
  const { data, info } = await sharp(fp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) return;
  const buf = Buffer.from(data);
  let cleared = 0;
  for (let i = 0; i < buf.length; i += 4) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    if (r >= THRESHOLD && g >= THRESHOLD && b >= THRESHOLD) {
      buf[i + 3] = 0;
      cleared += 1;
    } else if (r >= 200 && g >= 200 && b >= 200) {
      const minC = Math.min(r, g, b);
      const a = Math.max(0, Math.round(((255 - minC) / (255 - 200)) * 255));
      buf[i + 3] = a;
    }
  }
  await sharp(buf, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(fp);
  console.log(`${rel}: cleared ${cleared} px (${width}x${height})`);
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
