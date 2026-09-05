/**
 * Captures what each library actually drew, for the side-by-side comparison page.
 *
 * SVG renderers give up their real markup, which stays vector on the page.
 * Canvas renderers can only give a PNG — which is precisely the point being made,
 * so the comparison shows their genuine output rather than a redrawn stand-in.
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const OUT = new URL('../dist-verify/samples.json', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = createServer(async (req, res) => {
  try {
    const rel = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    const file = join(DIST, rel === '/' ? 'index.html' : rel);
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 }, deviceScaleFactor: 3 });
await page.goto(base, { waitUntil: 'networkidle' });

const names = await page.$$eval('.switcher[aria-label="Chart library"] button', (bs) => bs.map((b) => b.textContent.trim()));
const samples = {};

// Two cards per library: one rising, one falling, so the shapes are comparable.
const CARD_INDEXES = [0, 3];

for (const name of names) {
  await page.click(`.switcher[aria-label="Chart library"] button:text-is("${name}")`);
  await page.waitForFunction(
    () => !document.querySelector('.grid--loading') && document.querySelectorAll('.mc').length === 10,
    null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(300);

  const captured = [];
  for (const idx of CARD_INDEXES) {
    const spark = page.locator('.mc__spark').nth(idx);
    const kind = await spark.evaluate((n) => (n.querySelector('svg') ? 'svg' : n.querySelector('canvas') ? 'canvas' : 'none'));
    if (kind === 'svg') {
      captured.push({ kind, markup: await spark.evaluate((n) => n.querySelector('svg').outerHTML) });
    } else {
      const png = await spark.locator('canvas').screenshot();
      captured.push({ kind, markup: `data:image/png;base64,${png.toString('base64')}` });
    }
  }
  samples[name] = captured;
}

await browser.close();
server.close();
await writeFile(OUT, JSON.stringify(samples, null, 2));
console.log(`captured ${Object.keys(samples).length} libraries -> ${OUT}`);
for (const [k, v] of Object.entries(samples)) {
  console.log(`  ${k.padEnd(18)} ${v[0].kind.padEnd(7)} ${(v[0].markup.length / 1024).toFixed(1)} KB`);
}
