// Turns the original images in media-src/ into web-ready AVIF + WebP files in
// public/media/, and writes src/content/media.json with sizes, srcsets and a
// tiny blurred placeholder for each image.
//
// Run:  npm run media
// Re-run whenever you add or replace an image in media-src/.

import { readdir, readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// fileURLToPath, not .pathname: the project folder has spaces in its path ("Portfolio Site").
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'media-src');
const OUT = join(ROOT, 'public', 'media');
const MANIFEST = join(ROOT, 'src', 'content', 'media.json');

// Panels are square and up to one viewport tall; viewer images fill the screen.
const WIDTHS = {
  thumbs: [640, 1080, 1600],
  full: [1280, 1920, 2880],
  default: [1280, 1920],
};

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(png|jpe?g|gif|webp)$/i.test(entry.name)) out.push(p);
  }
  return out;
}

function widthsFor(rel, srcWidth) {
  const kind = rel.includes('/thumbs/') ? 'thumbs' : rel.includes('/full/') ? 'full' : 'default';
  const list = WIDTHS[kind].filter((w) => w < srcWidth);
  // Always include one size at (or capped near) the source width.
  const top = Math.min(srcWidth, WIDTHS[kind].at(-1));
  if (!list.includes(top)) list.push(top);
  return list;
}

async function newer(src, dest) {
  try {
    return (await stat(src)).mtimeMs > (await stat(dest)).mtimeMs;
  } catch {
    return true;
  }
}

const manifest = {};
const files = await walk(SRC);

for (const file of files) {
  const rel = relative(SRC, file).split('\\').join('/');
  const stem = rel.slice(0, -extname(rel).length);
  const outDir = join(OUT, dirname(rel));
  await mkdir(outDir, { recursive: true });

  const animated = /\.gif$/i.test(file);
  const meta = await sharp(file, { animated }).metadata();
  const srcW = meta.width;
  const srcH = animated ? meta.pageHeight : meta.height;
  const entry = { width: srcW, height: srcH, avif: [], webp: [] };

  if (animated) {
    // Animated GIF -> animated WebP at its native size (AVIF animation is not supported by sharp).
    const dest = join(OUT, `${stem}.webp`);
    if (await newer(file, dest)) {
      await sharp(file, { animated: true }).webp({ quality: 80, effort: 4 }).toFile(dest);
    }
    entry.webp.push(`/media/${stem}.webp ${srcW}w`);
    entry.animated = true;
  } else {
    for (const w of widthsFor(rel, srcW)) {
      const base = join(OUT, `${stem}-${w}`);
      if (await newer(file, `${base}.webp`)) {
        await sharp(file).resize({ width: w }).webp({ quality: 82, effort: 5 }).toFile(`${base}.webp`);
      }
      if (await newer(file, `${base}.avif`)) {
        await sharp(file).resize({ width: w }).avif({ quality: 55, effort: 4 }).toFile(`${base}.avif`);
      }
      entry.webp.push(`/media/${stem}-${w}.webp ${w}w`);
      entry.avif.push(`/media/${stem}-${w}.avif ${w}w`);
    }
  }

  // ~16px wide blurred placeholder, inlined as a data URI.
  const tiny = await sharp(file, { animated: false }).resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
  entry.blur = `data:image/webp;base64,${tiny.toString('base64')}`;
  entry.fallback = entry.webp.at(-1).split(' ')[0];
  entry.avif = entry.avif.join(', ');
  entry.webp = entry.webp.join(', ');
  manifest[rel] = entry;
  console.log(`ok  ${rel}  ${srcW}x${srcH}${animated ? ' (animated)' : ''}`);
}

// The resume's pages come from scripts/build-resume.mjs (npm run resume), not media-src; keep them.
try {
  const previous = JSON.parse(await readFile(MANIFEST, 'utf8'));
  for (const [key, entry] of Object.entries(previous)) if (key.startsWith('resume/') && !manifest[key]) manifest[key] = entry;
} catch {
  // no manifest yet
}

await mkdir(dirname(MANIFEST), { recursive: true });
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${Object.keys(manifest).length} images -> ${relative(ROOT, MANIFEST)}  (${basename(OUT)}/)`);
