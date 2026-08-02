import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destinationDirectory = path.join(projectRoot, 'dist', 'data');

mkdirSync(destinationDirectory, { recursive: true });

for (const fileName of ['shop.store.json', 'activities.store.json']) {
  copyFileSync(
    path.join(projectRoot, 'src', 'data', fileName),
    path.join(destinationDirectory, fileName),
  );
}
