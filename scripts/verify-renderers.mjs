/**
 * Loads the built app in Chromium, switches to each library in turn, and checks
 * that it actually drew something — a lazy chunk that throws or a chart that
 * silently renders nothing both look fine until you open the page.
 *
 * Run `npm run build` first; this drives the production bundle, not the dev server.
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { mkdirSync } from 'node:fs';
import JSZip from 'jszip';

const DIST = new URL('../dist/', import.meta.url).pathname;
const SHOTS = new URL('../dist-verify/shots/', import.meta.url).pathname;
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
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 }, deviceScaleFactor: 2 });

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(base, { waitUntil: 'networkidle' });

const names = await page.$$eval('.switcher button', (bs) => bs.map((b) => b.textContent.trim()));
const results = [];

for (const name of names) {
  errors.length = 0;
  await page.click(`.switcher button:text-is("${name}")`);
  await page.waitForFunction(
    () => !document.querySelector('.grid--loading') && document.querySelectorAll('.metric-card').length === 6,
    null,
    { timeout: 15000 },
  );
  // Give canvas renderers a frame to paint before measuring.
  await page.waitForTimeout(250);

  const drew = await page.$$eval('.metric-card__spark', (nodes) =>
    nodes.map((n) => {
      const svg = n.querySelector('svg');
      if (svg) {
        const paths = svg.querySelectorAll('path, polyline, line');
        return { kind: 'svg', marks: paths.length };
      }
      const c = n.querySelector('canvas');
      if (c) {
        const ctx = c.getContext('2d');
        const { data } = ctx.getImageData(0, 0, c.width, c.height);
        let painted = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
        return { kind: 'canvas', marks: painted };
      }
      return { kind: 'none', marks: 0 };
    }),
  );

  // An SVG sparkline must carry three marks: area fill, dashed average, trend
  // line. Recharts once rendered only two — `<Line>` inside `<AreaChart>` is
  // silently dropped — and a bare "> 0" check waved it through.
  const MIN_SVG_MARKS = 3;
  const ok =
    drew.length === 6 &&
    drew.every((d) =>
      d.kind === 'svg' ? d.marks >= MIN_SVG_MARKS : d.kind === 'canvas' ? d.marks > 0 : false,
    );
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await page.locator('.grid').screenshot({ path: join(SHOTS, `${slug}.png`) });

  results.push({ name, ok, kind: drew[0]?.kind ?? 'none', marks: drew[0]?.marks ?? 0, errors: [...errors] });
}

// The export button is the headline feature, and the Node-side check in
// verify-pptx.ts exercises the deck builder rather than the browser path.
// Click it for real and inspect what the browser actually hands the user.
let exportResult;
try {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.click('button.export'),
  ]);
  const path = join(SHOTS, '..', 'browser-export.pptx');
  await download.saveAs(path);
  const buf = await readFile(path);
  const zip = await JSZip.loadAsync(buf);
  const files = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const charts = files.filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n));
  const media = files.filter((n) => n.startsWith('ppt/media/'));
  exportResult = {
    ok: download.suggestedFilename().endsWith('.pptx') && charts.length === 6 && media.length === 0,
    detail: `${download.suggestedFilename()}, ${charts.length} chart part(s), ${media.length} media file(s), ${(buf.byteLength / 1024).toFixed(0)} KB`,
  };
} catch (err) {
  exportResult = { ok: false, detail: `export failed: ${String(err).slice(0, 120)}` };
}

await browser.close();
server.close();

const width = Math.max(...results.map((r) => r.name.length));
for (const r of results) {
  const detail = r.ok
    ? `${r.kind}, ${r.marks} mark(s) per card`
    : `${r.kind === 'svg' ? `only ${r.marks} mark(s), expected >= 3` : 'no output'} ${r.errors.slice(0, 2).join(' | ')}`;
  console.log(`${r.ok ? '  PASS' : '  FAIL'}  ${r.name.padEnd(width)}  ${detail}`);
}
console.log(`${exportResult.ok ? '  PASS' : '  FAIL'}  ${'Export to PowerPoint'.padEnd(width)}  ${exportResult.detail}`);
console.log(`\n  screenshots: ${SHOTS}\n`);

const failed = [...results, { name: 'export', ok: exportResult.ok }].filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`${failed.length} renderer(s) drew incompletely.`);
  process.exit(1);
}
console.log(`  All ${results.length} renderers drew, and the browser export is native.\n`);
