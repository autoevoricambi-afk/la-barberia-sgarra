import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const files = [
  'index.html',
  'privacy.html',
  'styles.css',
  'script.js',
  'config.js',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  'sw.js'
];
const directories = ['assets', 'admin'];

if (path.dirname(output) !== root || path.basename(output) !== 'dist') {
  throw new Error('Output directory non sicura.');
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of files) {
  const source = path.join(root, file);
  if (!fs.statSync(source).isFile()) throw new Error(`File pubblico mancante: ${file}`);
  fs.copyFileSync(source, path.join(output, file));
}

for (const directory of directories) {
  const source = path.join(root, directory);
  if (!fs.statSync(source).isDirectory()) throw new Error(`Directory pubblica mancante: ${directory}`);
  fs.cpSync(source, path.join(output, directory), { recursive: true, dereference: true });
}

const published = fs.readdirSync(output).sort();
process.stdout.write(`Output statico whitelist creato: ${published.join(', ')}\n`);
