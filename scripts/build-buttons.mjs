// Builds the animated nav buttons from Jim's exported SVG frames.
//
// Reads button-art/frames.json and button-art/<button>/SVGs/*.svg, and writes:
//   src/assets/buttons/<button>-frame-<k>.svg  hover frame k (0 = resting, last = held end frame)
//   src/assets/buttons/<button>-active.svg     the selected frame
//   src/content/buttonArt.ts                   sizes, frames and timing for ButtonArt.tsx
//
// Every frame gets its own file, drawn the same way as the active frame, so the last hover frame
// and the selected frame always line up exactly. (An earlier version put all the frames side by
// side in one long "film strip" image and slid it; Firefox could land that a couple of pixels off.)
//
// The artwork is never changed: each frame's contents are copied verbatim into its own <svg>
// (same viewBox as the export), and the script checks that afterwards. The shapes are exported
// without a fill, so they draw in the color set on that wrapper (frames.json "color", the logo's ink).
//
// Run:  npm run buttons
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not .pathname: the project folder has spaces in its path ("Portfolio Site").
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ART = join(ROOT, 'button-art');
const OUT = join(ROOT, 'src', 'assets', 'buttons');
const MODULE = join(ROOT, 'src', 'content', 'buttonArt.ts');

const config = JSON.parse(await readFile(join(ART, 'frames.json'), 'utf8'));
const fps = config.fps ?? 12;
const color = config.color ?? '#000000';
if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color)) throw new Error(`frames.json color "${color}" should be a hex color`);

/** Split an exported SVG into its root viewBox and its inner markup (everything inside <svg>…</svg>). */
function parse(svg, file) {
  const open = svg.indexOf('<svg');
  const openEnd = svg.indexOf('>', open);
  const close = svg.lastIndexOf('</svg>');
  if (open < 0 || openEnd < 0 || close < 0) throw new Error(`${file}: not an SVG`);
  const rootTag = svg.slice(open, openEnd + 1);
  const viewBox = rootTag.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) throw new Error(`${file}: no viewBox`);
  const [, , w, h] = viewBox.split(/[\s,]+/).map(Number);
  return { viewBox, w, h, inner: svg.slice(openEnd + 1, close) };
}

/** Map artboard numbers ("04") to files in a button's SVGs folder (design-wide-04.svg). */
async function framesIn(dir) {
  const map = new Map();
  for (const name of await readdir(dir)) {
    const m = name.match(/(\d+)\.svg$/i);
    if (m) map.set(m[1].padStart(2, '0'), join(dir, name));
  }
  return map;
}

await mkdir(OUT, { recursive: true });
const entries = [];
const imports = [];

for (const [button, spec] of Object.entries(config.buttons)) {
  // Frames come from <button>/SVGs, or the folder named in "dir" (e.g. "SVGs/BotLeft").
  const dir = spec.dir ?? 'SVGs';
  const files = await framesIn(join(ART, button, dir));
  // An artboard number ("04" -> design-wide-04.svg), a file name in that folder ("resume-wide.svg"),
  // or a path from the button's folder ("SVGs/resume-wide.svg").
  const pick = (n) => {
    const file = n.includes('/')
      ? join(ART, button, n)
      : /\.svg$/i.test(n)
        ? join(ART, button, dir, n)
        : files.get(String(n).padStart(2, '0'));
    if (!file) throw new Error(`${button}: no SVG numbered ${n} in ${button}/${dir}`);
    return file;
  };

  const frames = [];
  for (const n of spec.frames) {
    const file = pick(n);
    frames.push({ n, file, ...parse(await readFile(file, 'utf8'), file) });
  }
  const { viewBox, w, h } = frames[0];
  for (const f of frames) {
    if (f.viewBox !== viewBox) throw new Error(`${button}: ${f.file} is ${f.viewBox}, expected ${viewBox}`);
    if (/fill[=:]|<style|class=/.test(f.inner)) console.warn(`${button}: ${f.file} sets its own colors; those shapes ignore frames.json "color"`);
  }

  const id = button.replace(/-(\w)/g, (_, c) => c.toUpperCase());
  /** One frame as its own SVG: the export's markup, verbatim, in a wrapper that only sets the color. */
  const write = async (name, frame) => {
    const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${w}" height="${h}" fill="${color}">${frame.inner}</svg>\n`;
    if (parse(out, name).inner !== frame.inner) throw new Error(`${button}: ${frame.file} changed while building`);
    await writeFile(join(OUT, name), out);
    return out.length;
  };

  const frameRefs = [];
  let bytes = 0;
  for (const [k, f] of frames.entries()) {
    bytes += await write(`${button}-frame-${k}.svg`, f);
    imports.push(`import ${id}Frame${k} from '../assets/buttons/${button}-frame-${k}.svg'`);
    frameRefs.push(`${id}Frame${k}`);
  }
  let activeRef = 'undefined';
  if (spec.active) {
    const file = pick(spec.active);
    const active = { file, ...parse(await readFile(file, 'utf8'), file) };
    if (active.viewBox !== viewBox) throw new Error(`${button}: active frame has a different artboard`);
    bytes += await write(`${button}-active.svg`, active);
    imports.push(`import ${id}Active from '../assets/buttons/${button}-active.svg'`);
    activeRef = `${id}Active`;
  }
  entries.push(`  '${button}': { frames: [${frameRefs.join(', ')}], active: ${activeRef}, width: ${w}, height: ${h} },`);
  const kb = (b) => `${(b / 1024).toFixed(0)} KB`;
  console.log(`${button}: ${frames.length} frames from ${dir} (${spec.frames.join(' ')})${spec.active ? `, active ${spec.active}` : ''} | ${kb(bytes)}`);
}

await writeFile(
  MODULE,
  `// Generated by scripts/build-buttons.mjs from button-art/. Do not edit; run \`npm run buttons\`.
${imports.join('\n')}

export interface ButtonArtSpec {
  /** Hover frames in order: first = resting, last = held end frame. */
  frames: string[]
  /** Selected-category frame, if the button has one. */
  active: string | undefined
  /** Artboard size of one frame. */
  width: number
  height: number
}

export const buttonFps = ${fps}

export const buttonArt = {
${entries.join('\n')}
} satisfies Record<string, ButtonArtSpec>

export type ButtonArtName = keyof typeof buttonArt
`,
);
console.log(`wrote ${Object.keys(config.buttons).length} buttons to src/assets/buttons and src/content/buttonArt.ts`);
// The old film strips (<button>-strip.svg) aren't used any more. This script doesn't delete anything.
