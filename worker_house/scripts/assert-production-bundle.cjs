const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const outputDirectory = path.resolve(
  projectRoot,
  process.env.MINIPROGRAM_BUNDLE_DIR || 'dist',
);

const forbiddenSeeds = [
  ['activity seed', 'act-001'],
  ['activity seed', 'act-002'],
  ['activity seed', 'act-20260822-clay'],
  ['poster seed', 'poster-001'],
  ['community seed', 'post-001'],
  ['product seed', 'bottled-water-550ml'],
  ['product seed', 'cocktail-afterwork-sour'],
  ['product seed', 'prod-coffee-box'],
  ['member seed', 'profile-default-001'],
  ['member seed', 'worker-house-member-state-v5'],
  ['admin fulfillment seed', 'WA-MOCK-ACTIVITY-001'],
  ['mock identity', 'mock_openid_001'],
  ['mock contact', 'Linkaifeng'],
  ['mock contact', '13800000000'],
];

function collectJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScriptFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith('.js') ? [absolutePath] : [];
  });
}

if (!fs.existsSync(outputDirectory)) {
  console.error(`[bundle-check] build output does not exist: ${outputDirectory}`);
  process.exit(1);
}

const findings = [];
for (const filePath of collectJavaScriptFiles(outputDirectory)) {
  const source = fs.readFileSync(filePath, 'utf8');
  for (const [kind, marker] of forbiddenSeeds) {
    if (source.includes(marker)) {
      findings.push(`${kind} ${JSON.stringify(marker)} in ${path.relative(outputDirectory, filePath)}`);
    }
  }
}

if (findings.length > 0) {
  console.error('[bundle-check] production bundle contains local mock business data:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`[bundle-check] passed: ${outputDirectory}`);
