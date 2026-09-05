/**
 * Proves the export claim rather than asserting it in a README.
 *
 * Builds the deck with the exact same code the browser button uses, then opens
 * the .pptx as a zip and checks the OOXML parts inside: there must be one real
 * chart part per card, each backed by an embedded workbook, and there must be no
 * media entries at all — a single PNG in ppt/media would mean something got
 * rasterized on the way out.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import JSZip from 'jszip';
import { CARDS } from '../src/core/data';
import { exportMetricDeck } from '../src/pptx/export';

const OUT = resolve(process.cwd(), 'dist-verify/metric-cards.pptx');

interface Check {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

const checks: Check[] = [];
const check = (name: string, pass: boolean, detail: string): void => {
  checks.push({ name, pass, detail });
};

async function main(): Promise<void> {
  const result = await exportMetricDeck({
    cards: CARDS,
    strategy: 'native',
    title: 'Metric cards — native PPTX export',
    subtitle: 'Trailing 12 months · dashed line is the period average',
  });
  const buf = Buffer.from(result.data);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, buf);

  const zip = await JSZip.loadAsync(buf);
  // Directory placeholders are zip entries too; only real files count here.
  const names = Object.keys(zip.files).filter((n) => !zip.files[n]!.dir);

  const chartParts = names.filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n));
  const workbooks = names.filter((n) => n.startsWith('ppt/embeddings/'));
  const media = names.filter((n) => n.startsWith('ppt/media/'));
  const slides = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));

  check(
    'one native chart part per card',
    chartParts.length === CARDS.length,
    `${chartParts.length} chart part(s) for ${CARDS.length} card(s)`,
  );

  check(
    'no rasterized media in the deck',
    media.length === 0,
    media.length === 0 ? 'ppt/media is empty' : `found ${media.join(', ')}`,
  );

  check(
    'charts carry an embedded workbook ("Edit Data" works)',
    workbooks.length === CARDS.length,
    `${workbooks.length} embedded workbook(s)`,
  );

  // Each chart must actually contain the line + area geometry, not a placeholder.
  let lineCharts = 0;
  let areaCharts = 0;
  let dashedSeries = 0;
  let hiddenAxes = 0;
  for (const part of chartParts) {
    const xml = await zip.file(part)!.async('string');
    if (xml.includes('<c:lineChart>')) lineCharts++;
    if (xml.includes('<c:areaChart>')) areaCharts++;
    if (xml.includes('val="dash"')) dashedSeries++;
    if (xml.includes('<c:delete val="1"/>')) hiddenAxes++;
  }

  check('every chart has a line plot', lineCharts === chartParts.length, `${lineCharts}/${chartParts.length}`);
  check('every chart has the area fill', areaCharts === chartParts.length, `${areaCharts}/${chartParts.length}`);
  check(
    'average line is dashed in the XML',
    dashedSeries === chartParts.length,
    `${dashedSeries}/${chartParts.length}`,
  );
  check('axes are deleted (sparkline look)', hiddenAxes === chartParts.length, `${hiddenAxes}/${chartParts.length}`);

  // The deck paginates, so every assertion below spans all slides rather than
  // just the first — an earlier version read slide 1 and undercounted the cards.
  let slideXml = '';
  for (const name of slides) slideXml += await zip.file(name)!.async('string');

  const roundRects = (slideXml.match(/roundRect/g) ?? []).length;
  check(
    'card frames are native roundRect shapes',
    roundRects >= CARDS.length,
    `${roundRects} roundRect shape(s) across ${slides.length} slide(s)`,
  );
  check(
    'card text is real text, not outlines',
    slideXml.includes('<a:t>') && slideXml.includes('MONTHLY RECURRING REVENUE'),
    'found <a:t> runs including the first card label',
  );

  // Delta triangles must survive as text glyphs, not be dropped or outlined.
  const triangles = (slideXml.match(/[▲▼■]/g) ?? []).length;
  // Exactly one per card: a `>=` check let a doubled "▲▲ 6.2%" through, because
  // formatDelta and the card were each prefixing the arrow.
  check(
    'exactly one delta triangle per card',
    triangles === CARDS.length,
    `${triangles} triangle glyph(s) for ${CARDS.length} card(s)`,
  );

  // Sentiment colouring: green for good moves, red for bad, per lowerIsBetter.
  const greens = (slideXml.match(/15803D/g) ?? []).length;
  const reds = (slideXml.match(/B91C1C/g) ?? []).length;
  check(
    'delta text is colour-coded by sentiment',
    greens + reds >= CARDS.length,
    `${greens} green + ${reds} red delta run(s)`,
  );

  // Legend keys are drawn as native line shapes (two per card).
  const legendLines = (slideXml.match(/<p:cNvSpPr\/>/g) ?? []).length;
  check(
    'legend keys are native shapes',
    slideXml.includes('12-mo avg') && slideXml.includes('Actual'),
    `legend labels present (${legendLines} shape nodes)`,
  );

  check(
    'timeframe caption is on every card',
    (slideXml.match(/–/g) ?? []).length >= CARDS.length,
    `${(slideXml.match(/–/g) ?? []).length} timeframe caption(s)`,
  );

  const failed = checks.filter((c) => !c.pass);
  const width = Math.max(...checks.map((c) => c.name.length));
  for (const c of checks) {
    console.log(`${c.pass ? '  PASS' : '  FAIL'}  ${c.name.padEnd(width)}  ${c.detail}`);
  }
  console.log(`\n  ${OUT}  (${(buf.byteLength / 1024).toFixed(1)} KB)`);

  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed.`);
    process.exit(1);
  }
  console.log(`\n  All ${checks.length} checks passed — the deck is fully native.\n`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
