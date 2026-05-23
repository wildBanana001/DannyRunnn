// 扫描 src/assets 下所有 PNG，输出哪些「无 alpha 通道」或「整体偏白底」需要做透明处理
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..', 'src', 'assets');

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp, out);
    else if (/\.png$/i.test(name)) out.push(fp);
  }
}

(async () => {
  const files = [];
  walk(ROOT, files);
  for (const fp of files) {
    try {
      const meta = await sharp(fp).metadata();
      const { data, info } = await sharp(fp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let whiteish = 0;
      let total = info.width * info.height;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a > 200 && r >= 240 && g >= 240 && b >= 240) whiteish++;
      }
      const ratio = whiteish / total;
      const flag = (!meta.hasAlpha ? '[NO_ALPHA] ' : '') + (ratio > 0.05 ? `[WHITE ${(ratio * 100).toFixed(1)}%]` : '');
      if (flag.trim()) console.log(`${flag.padEnd(28)} ${path.relative(ROOT, fp)}`);
    } catch (e) {
      console.error('fail', fp, e.message);
    }
  }
})();
