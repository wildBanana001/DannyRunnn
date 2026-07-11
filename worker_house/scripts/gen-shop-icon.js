const sharp = require('sharp');
const fs = require('fs');

// 购物袋 SVG，81x81，与其他 tab 图标一致
function bagSvg(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 81 81">
  <g fill="none" stroke="${color}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
    <path d="M20 28 h41 l4 40 a4 4 0 0 1 -4 4 h-41 a4 4 0 0 1 -4 -4 z"/>
    <path d="M30 32 v-6 a10.5 10.5 0 0 1 21 0 v6"/>
  </g>
</svg>`;
}

async function run() {
  const targets = [
    { name: 'tab-shop-normal.png', color: '#8B7355' },
    { name: 'tab-shop-active.png', color: '#E63946' },
  ];
  for (const t of targets) {
    await sharp(Buffer.from(bagSvg(t.color)))
      .resize(81, 81)
      .png()
      .toFile('src/assets/tabbar/' + t.name);
    console.log('generated', t.name, fs.statSync('src/assets/tabbar/' + t.name).size, 'B');
  }
}
run();
