/**
 * Re-encodes the benchmark screenshots to WebP data URIs for the comparison page.
 *
 * Artifacts can only load images the page carries itself, so every screenshot has
 * to be inlined — PNG would push the page past its size budget for no visual gain.
 */
import { chromium } from 'playwright-core';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SHOTS = new URL('../dist-verify/deck-shots/', import.meta.url).pathname;
const OUT = new URL('../dist-verify/images.json', import.meta.url).pathname;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();

const files = (await readdir(SHOTS)).filter((f) => f.endsWith('.png')).sort();
const out = {};
let rawTotal = 0;
let packedTotal = 0;

for (const file of files) {
  const buf = await readFile(join(SHOTS, file));
  rawTotal += buf.byteLength;
  const src = `data:image/png;base64,${buf.toString('base64')}`;
  // Web screenshots are 2× DPR and can afford a downscale; slide renders are
  // already at 96dpi and need every pixel they have.
  const maxW = file.startsWith('web-') ? 1180 : 1280;

  const webp = await page.evaluate(
    async ({ src, maxW, quality }) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = src;
      });
      const scale = Math.min(1, maxW / img.naturalWidth);
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', quality);
    },
    { src, maxW, quality: 0.86 },
  );

  out[file.replace(/\.png$/, '')] = webp;
  packedTotal += webp.length * 0.75;
}

await browser.close();
await writeFile(OUT, JSON.stringify(out));
console.log(
  `  ${files.length} images  ${(rawTotal / 1024 / 1024).toFixed(1)} MB PNG -> ` +
    `${(packedTotal / 1024 / 1024).toFixed(1)} MB WebP`,
);
