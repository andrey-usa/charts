/**
 * Measures the real export path: a real browser, the same code the Export button
 * runs, every library against every strategy it can serve.
 *
 * For each combination it times three runs and keeps the median, saves the .pptx,
 * renders it back through LibreOffice so the exported result can be seen rather
 * than described, and inspects the OOXML to report what actually survived.
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import JSZip from 'jszip';

const run = promisify(execFile);
const DIST = new URL('../dist/', import.meta.url).pathname;
const OUT = new URL('../dist-verify/', import.meta.url).pathname;
const DECKS = join(OUT, 'decks');
const SHOTS = join(OUT, 'deck-shots');
const RUNS = 3;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

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

await rm(DECKS, { recursive: true, force: true });
await rm(SHOTS, { recursive: true, force: true });
await mkdir(DECKS, { recursive: true });
await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 2 });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.goto(base, { waitUntil: 'networkidle' });

const libraries = await page.evaluate(() =>
  [...document.querySelectorAll('.switcher[aria-label="Chart library"] button')].map((b) => b.textContent.trim()),
);

const results = [];

for (const lib of libraries) {
  await page.click(`.switcher[aria-label="Chart library"] button:text-is("${lib}")`);
  await page.waitForFunction(
    () => !document.querySelector('.grid--loading') && document.querySelectorAll('.mc').length === 10,
    null,
    { timeout: 20000 },
  );
  await page.waitForTimeout(300);

  // Screenshot the on-screen cards for the side-by-side comparison.
  const slug = lib.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await page.locator('.grid').screenshot({ path: join(SHOTS, `web-${slug}.png`) });

  const supported = await page.evaluate(() =>
    [...document.querySelectorAll('.switcher[aria-label="Export strategy"] button')]
      .filter((b) => !b.disabled)
      .map((b) => b.textContent.trim().toLowerCase().split(' ')[0]),
  );

  for (const strategy of supported) {
    pageErrors.length = 0;
    const measured = await page.evaluate(
      async ({ strategy, runs }) => {
        const { CARDS, captureFor, exportMetricDeck } = window.__chartsBench;
        const opts = () => ({
          cards: CARDS,
          strategy,
          capture: strategy === 'native' ? undefined : captureFor(strategy),
          title: 'Metric cards',
          subtitle: 'Trailing 12 months',
        });

        const samples = [];
        let last = null;
        for (let i = 0; i < runs; i++) {
          last = await exportMetricDeck(opts());
          samples.push(last.timings);
        }

        // Transfer the bytes once, after timing, so encoding cost stays out of it.
        const bytes = new Uint8Array(last.data);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return { samples, slides: last.slides, bytes: last.bytes, b64: btoa(bin) };
      },
      { strategy, runs: RUNS },
    );

    const buf = Buffer.from(measured.b64, 'base64');
    const file = join(DECKS, `${slug}-${strategy}.pptx`);
    await writeFile(file, buf);

    // What survived: chart parts mean editable charts, media means images.
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    const charts = names.filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n)).length;
    const media = names.filter((n) => n.startsWith('ppt/media/'));
    const svgMedia = media.filter((n) => n.endsWith('.svg')).length;
    const pngMedia = media.filter((n) => n.endsWith('.png')).length;

    results.push({
      library: lib,
      slug,
      strategy,
      timings: {
        captureMs: median(measured.samples.map((s) => s.captureMs)),
        composeMs: median(measured.samples.map((s) => s.composeMs)),
        serializeMs: median(measured.samples.map((s) => s.serializeMs)),
        totalMs: median(measured.samples.map((s) => s.totalMs)),
      },
      bytes: measured.bytes,
      slides: measured.slides,
      retained: { charts, svgMedia, pngMedia },
      errors: [...pageErrors],
    });

    console.log(
      `  ${lib.padEnd(17)} ${strategy.padEnd(7)} ` +
        `${median(measured.samples.map((s) => s.totalMs)).toFixed(0).padStart(5)} ms  ` +
        `${(measured.bytes / 1024).toFixed(0).padStart(4)} KB  ` +
        `charts:${charts} svg:${svgMedia} png:${pngMedia}`,
    );
  }
}

await browser.close();
server.close();

// Render every deck back to images through LibreOffice, so the exported result
// can be looked at instead of taken on trust.
console.log('\n  rendering decks through LibreOffice...');
const decks = (await readdir(DECKS)).filter((f) => f.endsWith('.pptx'));
for (const deck of decks) {
  await run('soffice', [
    '--headless', '--norestore',
    '-env:UserInstallation=file:///tmp/lo-bench',
    '--convert-to', 'pdf', '--outdir', SHOTS, join(DECKS, deck),
  ], { timeout: 240000 }).catch((e) => console.error(`    ${deck}: ${e.message.slice(0, 90)}`));

  const pdf = join(SHOTS, deck.replace(/\.pptx$/, '.pdf'));
  await run('pdftoppm', ['-png', '-r', '96', pdf, join(SHOTS, `pptx-${deck.replace(/\.pptx$/, '')}`)], {
    timeout: 120000,
  }).catch(() => {});
  await rm(pdf, { force: true });
}

const shots = (await readdir(SHOTS)).filter((f) => f.endsWith('.png'));
console.log(`  ${shots.length} slide image(s) rendered`);

await writeFile(join(OUT, 'bench.json'), JSON.stringify({ generatedAt: new Date().toISOString(), runs: RUNS, results }, null, 2));
console.log(`\n  ${results.length} library x strategy combinations -> dist-verify/bench.json\n`);
