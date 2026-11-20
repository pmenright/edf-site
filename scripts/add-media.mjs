// Adds (or replaces) images in the optimized media set without rebuilding everything.
//
//   npm run add-media -- <image> <key> [<image> <key> ...]
//   npm run add-media -- ~/Desktop/candescent.png design/thumbs/candescent.png
//
// The key is where the image would sit inside media-src/ (e.g. design/thumbs/x.png or
// design/full/x_full.png); it's also how projects.json refers to it. Each image is made into the same
// AVIF + WebP sizes as `npm run media` (thumbs: 640/1080/1600, full: 1280/1920/2880, never wider than
// the original) in public/media/, and its entry in src/content/media.json is added or replaced.
// Everything else in media.json stays as it is. Keep the originals somewhere safe (_for-media-src/).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// fileURLToPath, not .pathname: the project folder has spaces in its path ("Portfolio Site").
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public', 'media');
const MANIFEST = join(ROOT, 'src', 'content', 'media.json');
// Same sizes and settings as optimize-images.mjs.
const WIDTHS = { thumbs: [640, 1080, 1600], full: [1280, 1920, 2880], default: [1280, 1920] };

const args = process.argv.slice(2);
if (!args.length || args.length % 2) {
  console.error('Usage: npm run add-media -- <image> <key> [<image> <key> ...]');
  process.exit(1);
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
for (let i = 0; i < args.length; i += 2) {
  const file = resolve(args[i]);
  const key = args[i + 1].replace(/^\/+/, '');
  const stem = key.slice(0, -extname(key).length);
  const { width, height } = await sharp(file).metadata();
  const kind = key.includes('/thumbs/') ? 'thumbs' : key.includes('/full/') ? 'full' : 'default';
  const widths = WIDTHS[kind].filter((w) => w < width);
  const top = Math.min(width, WIDTHS[kind].at(-1));
  if (!widths.includes(top)) widths.push(top);

  await mkdir(join(OUT, dirname(key)), { recursive: true });
  const entry = { width, height, avif: [], webp: [] };
  for (const w of widths) {
    const base = join(OUT, `${stem}-${w}`);
    await sharp(file).resize({ width: w }).webp({ quality: 82, effort: 5 }).toFile(`${base}.webp`);
    await sharp(file).resize({ width: w }).avif({ quality: 55, effort: 4 }).toFile(`${base}.avif`);
    entry.webp.push(`/media/${stem}-${w}.webp ${w}w`);
    entry.avif.push(`/media/${stem}-${w}.avif ${w}w`);
  }
  const tiny = await sharp(file).resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
  entry.blur = `data:image/webp;base64,${tiny.toString('base64')}`;
  entry.fallback = entry.webp.at(-1).split(' ')[0];
  entry.avif = entry.avif.join(', ');
  entry.webp = entry.webp.join(', ');
  manifest[key] = entry;
  console.log(`ok  ${key}  ${width}x${height}  (${widths.join(', ')})`);
}
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`media.json now has ${Object.keys(manifest).length} images`);
