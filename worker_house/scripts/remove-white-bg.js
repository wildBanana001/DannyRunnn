// 把 src/assets/home/text/ 下的【白底字图】白底转为透明（就地覆盖）
// 黑底字图（btn-* / title-more-activities）跳过：抠白会把白字也抠掉
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const TEXT_DIR = path.resolve(__dirname, '..', 'src', 'assets', 'home', 'text');

// 黑底白字图，不应做白底抠除
const SKIP = new Set([
  'btn-book-activity.png',
  'btn-join-community.png',
  'btn-explore-more.png',
  'btn-more-fun.png',
  'btn-space-story.png',
  'title-more-activities.png',
]);

const THRESHOLD = 240;

async function processOne(file) {
  const fp = path.join(TEXT_DIR, file);
  const { data, info } = await sharp(fp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) {
    console.log(`skip ${file} (channels=${channels})`);
    return;
  }
  const buf = Buffer.from(data);
  let cleared = 0;
  for (let i = 0; i < buf.length; i += 4) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    if (r >= THRESHOLD && g >= THRESHOLD && b >= THRESHOLD) {
      buf[i + 3] = 0; // 完全透明
      cleared += 1;
    } else if (r >= 200 && g >= 200 && b >= 200) {
      // 边缘渐变：根据亮度等比降低 alpha，避免毛刺
      const minC = Math.min(r, g, b);
      const a = Math.max(0, Math.round(((255 - minC) / (255 - 200)) * 255));
      buf[i + 3] = a;
    }
  }
  await sharp(buf, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(fp);
  console.log(`${file}: cleared ${cleared} px`);
}

(async () => {
  const files = fs.readdirSync(TEXT_DIR).filter((f) => f.endsWith('.png') && !SKIP.has(f));
  for (const f of files) {
    try {
      await processOne(f);
    } catch (err) {
      console.error(`fail ${f}`, err.message);
    }
  }
})();
