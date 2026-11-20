// Makes the resume's page images for the viewer (RESUME > VIEW) from the PDF that DOWNLOAD hands out.
//
// Reads the PDF named by `resumeFile` in src/content/site.json (in public/downloads/), and:
//   - renders each page at 2040px wide (the AFC presentation's size) with pdftoppm,
//   - writes AVIF + WebP sizes to public/media/resume/full/, made the same way as `npm run media`,
//   - puts those pages into src/content/media.json (only the resume's entries change) and lists
//     them as `resumePages` in site.json,
//   - writes public/media/resume/full/pages.json, the same page list for the Nsyte copy's resume
//     lightbox (public/nsyte/assets/mirror.js), which isn't part of the React app.
//
// Run:  npm run resume     (again whenever the PDF changes)
// Needs pdftoppm (Poppler; on a Mac: brew install poppler). Nothing is ever deleted: if the resume
// gets shorter, the extra old page files are listed at the end so they can be cleared out by hand.
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// fileURLToPath, not .pathname: the project folder has spaces in its path ("Portfolio Site").
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = join(ROOT, 'src', 'content', 'site.json');
const MANIFEST = join(ROOT, 'src', 'content', 'media.json');
const OUT = join(ROOT, 'public', 'media', 'resume', 'full');
const WIDTH = 2040;
// The viewer's sizes for full-screen images (optimize-images.mjs, "full").
const SIZES = [1280, 1920, 2880];

const site = JSON.parse(await readFile(SITE, 'utf8'));
const pdf = join(ROOT, 'public', site.resumeFile);

try {
  execFileSync('pdftoppm', ['-v'], { stdio: 'ignore' });
} catch {
  throw new Error('pdftoppm not found. Install Poppler (on a Mac: brew install poppler), then run this again.');
}

// 1. PDF pages -> PNGs, in a temporary folder.
const tmp = await mkdtemp(join(tmpdir(), 'resume-'));
execFileSync('pdftoppm', ['-png', '-scale-to-x', String(WIDTH), '-scale-to-y', '-1', pdf, join(tmp, 'page')]);
const pngs = (await readdir(tmp)).filter((f) => f.endsWith('.png')).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));

// 2. PNGs -> AVIF + WebP sizes, plus the manifest entries.
await mkdir(OUT, { recursive: true });
const entries = {};
const written = new Set();
for (const [i, png] of pngs.entries()) {
  const file = join(tmp, png);
  const stem = `resume/full/page-${String(i + 1).padStart(2, '0')}`;
  const { width, height } = await sharp(file).metadata();
  const widths = SIZES.filter((w) => w < width);
  const top = Math.min(width, SIZES.at(-1));
  if (!widths.includes(top)) widths.push(top);
  const entry = { width, height, avif: [], webp: [] };
  for (const w of widths) {
    const base = join(ROOT, 'public', 'media', `${stem}-${w}`);
    await sharp(file).resize({ width: w }).webp({ quality: 82, effort: 5 }).toFile(`${base}.webp`);
    await sharp(file).resize({ width: w }).avif({ quality: 55, effort: 4 }).toFile(`${base}.avif`);
    entry.webp.push(`/media/${stem}-${w}.webp ${w}w`);
    entry.avif.push(`/media/${stem}-${w}.avif ${w}w`);
    written.add(`${stem.split('/').pop()}-${w}.webp`).add(`${stem.split('/').pop()}-${w}.avif`);
  }
  const tiny = await sharp(file).resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
  entry.blur = `data:image/webp;base64,${tiny.toString('base64')}`;
  entry.fallback = entry.webp.at(-1).split(' ')[0];
  entry.avif = entry.avif.join(', ');
  entry.webp = entry.webp.join(', ');
  entries[`${stem}.png`] = entry;
  console.log(`ok  page ${i + 1}  ${width}x${height}`);
}

// 3. Swap the resume's entries in media.json (everything else stays as it is), list the pages in site.json.
const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
for (const key of Object.keys(manifest)) if (key.startsWith('resume/')) delete manifest[key];
Object.assign(manifest, entries);
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
site.resumePages = Object.keys(entries);
await writeFile(SITE, JSON.stringify(site, null, 2) + '\n');
const pages = Object.values(entries).map(({ width, height, avif, webp, fallback }) => ({ width, height, avif, webp, fallback }));
await writeFile(join(OUT, 'pages.json'), JSON.stringify({ pdf: site.resumeFile, pages }, null, 2) + '\n');
written.add('pages.json');

console.log(`\n${pngs.length} pages from ${site.resumeFile} -> public/media/resume/full/, media.json, site.json resumePages`);
const leftover = (await readdir(OUT)).filter((f) => !written.has(f));
if (leftover.length) console.log(`Not used any more (safe to delete): ${leftover.join(', ')}`);
