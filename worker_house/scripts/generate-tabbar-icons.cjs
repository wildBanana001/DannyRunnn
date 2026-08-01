const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const SIZE = 81;
const STROKE = 4.6;
const NORMAL = '#7D736A';
const ACTIVE = '#C9473B';
const BAR_BACKGROUND = '#FFFCF7';
const outputDir = path.resolve(__dirname, '../src/assets/tabbar');
const previewPath = '/tmp/worker-house-tabbar-concept.png';

const iconBodies = {
  home: {
    normal: `
      <path d="M16.5 36.5 40.5 16.5l24 20v25.2a3.8 3.8 0 0 1-3.8 3.8H20.3a3.8 3.8 0 0 1-3.8-3.8V36.5Z" fill="none" stroke="${NORMAL}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M33 64.5V48.2h15v16.3" fill="none" stroke="${NORMAL}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
    `,
    active: `
      <path d="M15.2 35.7 40.5 14.8l25.3 20.9v26.1a5 5 0 0 1-5 5H20.2a5 5 0 0 1-5-5V35.7Z" fill="${ACTIVE}"/>
      <path d="M33.1 66.8V47.9a2.8 2.8 0 0 1 2.8-2.8h9.2a2.8 2.8 0 0 1 2.8 2.8v18.9H33.1Z" fill="${BAR_BACKGROUND}"/>
    `,
  },
  activity: {
    normal: `
      <rect x="16.8" y="20.4" width="47.4" height="44.4" rx="8" fill="none" stroke="${NORMAL}" stroke-width="${STROKE}"/>
      <path d="M17.5 33.1h46M28 15.8v9.8M53 15.8v9.8M27 44h27M27 53.8h17" fill="none" stroke="${NORMAL}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
    `,
    active: `
      <rect x="15" y="18.7" width="51" height="48.2" rx="9.2" fill="${ACTIVE}"/>
      <path d="M15.8 32.7h49.4M28 14.8v10.4M53 14.8v10.4M27.2 43.8h27M27.2 54h17" fill="none" stroke="${BAR_BACKGROUND}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
    `,
  },
  shop: {
    normal: `
      <path d="M20 31.2h41l3.4 29.9a4.7 4.7 0 0 1-4.7 5.3H21.3a4.7 4.7 0 0 1-4.7-5.3L20 31.2Z" fill="none" stroke="${NORMAL}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M29.5 34v-7.3a11 11 0 0 1 22 0V34" fill="none" stroke="${NORMAL}" stroke-width="${STROKE}" stroke-linecap="round"/>
    `,
    active: `
      <path d="M18.5 29.2h44l3.7 32a5.2 5.2 0 0 1-5.2 5.8H20a5.2 5.2 0 0 1-5.2-5.8l3.7-32Z" fill="${ACTIVE}"/>
      <path d="M28.6 32v-6.6a11.9 11.9 0 0 1 23.8 0V32" fill="none" stroke="${ACTIVE}" stroke-width="${STROKE}" stroke-linecap="round"/>
      <circle cx="29" cy="40" r="2.4" fill="${BAR_BACKGROUND}"/>
      <circle cx="52" cy="40" r="2.4" fill="${BAR_BACKGROUND}"/>
    `,
  },
  wall: {
    normal: `
      <path d="M19 17.5h43v35.2L49.2 65.5H19V17.5Z" fill="none" stroke="${NORMAL}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M49.2 65.5V52.7H62M28 32.7h25M28 43.8h18" fill="none" stroke="${NORMAL}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
    `,
    active: `
      <path d="M16.8 15.3h47.4v38.3L50.5 67.3H16.8v-52Z" fill="${ACTIVE}"/>
      <path d="M50.5 67.3V53.6h13.7M27.5 31.5h26M27.5 43.2h18.5" fill="none" stroke="${BAR_BACKGROUND}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
    `,
  },
  mine: {
    normal: `
      <circle cx="40.5" cy="26" r="10.5" fill="none" stroke="${NORMAL}" stroke-width="${STROKE}"/>
      <path d="M17.5 65c1.5-12.8 10.6-20 23-20s21.5 7.2 23 20" fill="none" stroke="${NORMAL}" stroke-width="${STROKE}" stroke-linecap="round"/>
    `,
    active: `
      <circle cx="40.5" cy="25.2" r="11.8" fill="${ACTIVE}"/>
      <path d="M14.8 66.8c1.6-14.5 11.8-23 25.7-23s24.1 8.5 25.7 23H14.8Z" fill="${ACTIVE}"/>
    `,
  },
};

const outputNames = {
  home: 'tab-home',
  activity: 'tab-activity',
  shop: 'tab-shop',
  wall: 'tab-wall',
  mine: 'tab-mine',
};

function svgFor(body, width = SIZE, height = SIZE) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 81 81" fill="none" shape-rendering="geometricPrecision">${body}</svg>`;
}

async function renderIcons() {
  await fs.mkdir(outputDir, { recursive: true });
  for (const [name, states] of Object.entries(iconBodies)) {
    for (const [state, body] of Object.entries(states)) {
      const suffix = state === 'active' ? 'active' : 'normal';
      const target = path.join(outputDir, `${outputNames[name]}-${suffix}.png`);
      await sharp(Buffer.from(svgFor(body)))
        .resize(SIZE, SIZE, { fit: 'contain' })
        .png({ compressionLevel: 9, palette: false })
        .toFile(target);
      console.log(`generated ${path.basename(target)}`);
    }
  }
}

async function renderPreview() {
  const width = 1120;
  const height = 430;
  const iconSize = 112;
  const startX = 220;
  const gap = 170;
  const rows = [
    { key: 'normal', y: 102 },
    { key: 'active', y: 264 },
  ];
  const labels = ['HOME', 'EVENTS', 'SHOP', 'WALL', 'ME'];
  const names = Object.keys(iconBodies);
  const composites = [];

  rows.forEach((row) => {
    names.forEach((name, index) => {
      composites.push({
        input: Buffer.from(svgFor(iconBodies[name][row.key], iconSize, iconSize)),
        left: startX + index * gap,
        top: row.y,
      });
    });
  });

  const labelSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <style>
      .title { font: 700 30px -apple-system, BlinkMacSystemFont, sans-serif; fill: #342A24; letter-spacing: 1px; }
      .subtitle { font: 400 17px -apple-system, BlinkMacSystemFont, sans-serif; fill: #8E8379; }
      .row { font: 700 17px -apple-system, BlinkMacSystemFont, sans-serif; fill: #6B6158; letter-spacing: 1.5px; }
      .label { font: 600 14px -apple-system, BlinkMacSystemFont, sans-serif; fill: #8E8379; text-anchor: middle; letter-spacing: 1px; }
    </style>
    <text class="title" x="48" y="52">BOTTOM NAVIGATION ICON SYSTEM</text>
    <text class="subtitle" x="48" y="82">81 px · 4.6 px rounded stroke · accessible warm neutral / brick red</text>
    <text class="row" x="48" y="170">NORMAL</text>
    <text class="row" x="48" y="332">SELECTED</text>
    ${labels.map((label, index) => `<text class="label" x="${startX + index * gap + iconSize / 2}" y="412">${label}</text>`).join('')}
  </svg>`;

  composites.push({ input: Buffer.from(labelSvg), left: 0, top: 0 });
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#F7F4EE',
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(previewPath);
  console.log(`preview ${previewPath}`);
}

async function main() {
  await renderIcons();
  await renderPreview();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
