const fs = require('fs');
const path = require('path');

// 创建输出目录
const outputDir = path.join(__dirname, '../src/assets/icons');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 图标配置 - 极简风格
const iconSize = 48;
const colorDefault = '#999999';
const colorActive = '#E63946';

// SVG 图标定义 - 极简线条风格
const icons = {
  home: {
    default: `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 48 48" fill="none">
      <path d="M8 20L24 8L40 20V40C40 41.1 39.1 42 38 42H10C8.9 42 8 41.1 8 40V20Z" stroke="${colorDefault}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18 42V28H30V42" stroke="${colorDefault}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    active: `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 48 48" fill="none">
      <path d="M8 20L24 8L40 20V40C40 41.1 39.1 42 38 42H10C8.9 42 8 41.1 8 40V20Z" fill="${colorActive}" stroke="${colorActive}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18 42V28H30V42" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
  activity: {
    default: `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 48 48" fill="none">
      <rect x="6" y="8" width="36" height="32" rx="4" stroke="${colorDefault}" stroke-width="2.5"/>
      <circle cx="17" cy="22" r="3" fill="${colorDefault}"/>
      <circle cx="31" cy="22" r="3" fill="${colorDefault}"/>
      <path d="M16 32C18 34 21 35 24 35C27 35 30 34 32 32" stroke="${colorDefault}" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,
    active: `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 48 48" fill="none">
      <rect x="6" y="8" width="36" height="32" rx="4" fill="${colorActive}" stroke="${colorActive}" stroke-width="2.5"/>
      <circle cx="17" cy="22" r="3" fill="white"/>
      <circle cx="31" cy="22" r="3" fill="white"/>
      <path d="M16 32C18 34 21 35 24 35C27 35 30 34 32 32" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`
  },
  treehole: {
    default: `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 48 48" fill="none">
      <path d="M24 6C14 6 8 14 8 22C8 28 11 33 16 36V42L22 38C22.7 38.1 23.3 38.2 24 38.2C34 38.2 40 30.2 40 22.2C40 14.2 34 6 24 6Z" stroke="${colorDefault}" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="18" cy="22" r="2" fill="${colorDefault}"/>
      <circle cx="30" cy="22" r="2" fill="${colorDefault}"/>
    </svg>`,
    active: `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 48 48" fill="none">
      <path d="M24 6C14 6 8 14 8 22C8 28 11 33 16 36V42L22 38C22.7 38.1 23.3 38.2 24 38.2C34 38.2 40 30.2 40 22.2C40 14.2 34 6 24 6Z" fill="${colorActive}" stroke="${colorActive}" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="18" cy="22" r="2" fill="white"/>
      <circle cx="30" cy="22" r="2" fill="white"/>
    </svg>`
  },
  profile: {
    default: `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="16" r="8" stroke="${colorDefault}" stroke-width="2.5"/>
      <path d="M8 42C8 32 16 28 24 28C32 28 40 32 40 42" stroke="${colorDefault}" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,
    active: `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="16" r="8" fill="white" stroke="${colorActive}" stroke-width="2.5"/>
      <path d="M8 42C8 32 16 28 24 28C32 28 40 32 40 42" fill="${colorActive}" stroke="${colorActive}" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`
  }
};

// 将 SVG 保存为文件
Object.entries(icons).forEach(([name, svgs]) => {
  fs.writeFileSync(path.join(outputDir, `${name}.svg`), svgs.default);
  fs.writeFileSync(path.join(outputDir, `${name}-active.svg`), svgs.active);
  console.log(`Generated ${name}.svg and ${name}-active.svg`);
});

console.log('\n✅ Icons generated successfully!');
