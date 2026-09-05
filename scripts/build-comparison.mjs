/**
 * Generates the standalone side-by-side comparison page from the real captures
 * in dist-verify/samples.json.
 *
 * Inlined SVG from different libraries reuses ids (Recharts and ECharts both emit
 * clipPaths), so every specimen's ids are namespaced before it goes on the page —
 * otherwise the second copy of a sparkline gets clipped by the first one's rules.
 */
import { readFile, writeFile } from 'node:fs/promises';

const OUT = process.argv[2];
const samples = JSON.parse(await readFile(new URL('../dist-verify/samples.json', import.meta.url)));

const LIBS = [
  { key: 'Hand-rolled SVG', pkg: 'd3-shape 3.2', tech: 'SVG', kb: 2, tier: 'native',
    note: 'Two paths and a line. Every primitive maps onto something OOXML already has, so the card can be rebuilt as a real chart part.' },
  { key: 'visx', pkg: '@visx 3.12', tech: 'SVG · React', kb: 15, tier: 'vector',
    note: 'd3 maths, React rendering. No chart abstraction to fight, which is exactly why it needs the most code.' },
  { key: 'uPlot', pkg: 'uplot 1.6', tech: 'Canvas', kb: 23, tier: 'raster',
    note: 'The fastest here by a wide margin, and the right answer for tens of thousands of points. Canvas is a one-way door.' },
  { key: 'Chart.js', pkg: 'chart.js 4.5', tech: 'Canvas', kb: 51, tier: 'raster',
    note: 'Ubiquitous and pleasant to write. A slide can hold a screenshot of it and nothing better.' },
  { key: 'Observable Plot', pkg: '@observablehq/plot 0.6', tech: 'SVG', kb: 93, tier: 'vector',
    note: 'Grammar of graphics — three marks and the sparkline is done. The most expressive per line of code on this page.' },
  { key: 'Recharts', pkg: 'recharts 2.15', tech: 'SVG · React', kb: 107, tier: 'vector',
    note: 'The React default. Most of the work is turning its opinions off — and <Line> inside <AreaChart> silently draws nothing.' },
  { key: 'Apache ECharts', pkg: 'echarts 6.1', tech: 'SVG', kb: 373, tier: 'vector',
    note: 'Dashboards, maps, 3D, a full theming system. Also 160× the baseline to draw twelve points.' },
];

const TIERS = {
  native: { label: 'Native chart', rank: 1 },
  vector: { label: 'Vector image', rank: 2 },
  raster: { label: 'Raster only', rank: 3 },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Namespace ids so inlined library SVGs can't clip or mask each other. */
function nsIds(markup, prefix) {
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  let out = markup;
  for (const id of ids) {
    const safe = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`id="${safe}"`, 'g'), `id="${prefix}-${id}"`);
    out = out.replace(new RegExp(`url\\(#${safe}\\)`, 'g'), `url(#${prefix}-${id})`);
    out = out.replace(new RegExp(`href="#${safe}"`, 'g'), `href="#${prefix}-${id}"`);
  }
  return out;
}

/**
 * Normalizes a specimen's root <svg> without touching the drawing inside it.
 *
 * Libraries disagree about the root element: ECharts ships `position: absolute`
 * and no viewBox, so it escapes its container and anchors to the page instead of
 * the specimen box. Stripping the inline style and guaranteeing a viewBox makes
 * every library's output sit in its box identically — the marks themselves are
 * still exactly what the library drew.
 */
function normalizeRoot(markup) {
  return markup.replace(/^<svg\b([^>]*)>/, (full, attrs) => {
    let a = attrs.replace(/\sstyle="[^"]*"/, '');
    if (!/\sviewBox=/.test(a)) {
      const w = /\swidth="([\d.]+)"/.exec(a)?.[1];
      const h = /\sheight="([\d.]+)"/.exec(a)?.[1];
      if (w && h) a += ` viewBox="0 0 ${w} ${h}"`;
    }
    return `<svg${a}>`;
  });
}

function specimen(lib, idx, sample) {
  const prefix = `s${idx}-${sample.i}`;
  if (sample.kind === 'svg') return nsIds(normalizeRoot(sample.markup), prefix);
  return `<img src="${sample.markup}" width="277" height="53" alt="${esc(lib.key)} sparkline, rendered to canvas" />`;
}

const maxKb = Math.max(...LIBS.map((l) => l.kb));

const rows = LIBS.map((lib, idx) => {
  const [rise, fall] = samples[lib.key];
  const a = specimen(lib, idx, { ...rise, i: 0 });
  const b = specimen(lib, idx, { ...fall, i: 1 });
  return `
        <article class="spec spec--${lib.tier}">
          <div class="spec__id">
            <h3>${esc(lib.key)}</h3>
            <p class="spec__pkg">${esc(lib.pkg)} · ${esc(lib.tech)}</p>
          </div>
          <div class="spec__viz">
            <div class="viz"><div class="viz__in">${a}</div></div>
            <div class="viz"><div class="viz__in">${b}</div></div>
          </div>
          <div class="spec__cost">
            <span class="cost__num">${lib.kb}<span class="cost__unit">KB</span></span>
            <span class="cost__bar"><i style="width:${Math.max(1.5, (lib.kb / maxKb) * 100)}%"></i></span>
          </div>
          <div class="spec__tier">
            <span class="pill pill--${lib.tier}">${TIERS[lib.tier].label}</span>
          </div>
          <p class="spec__note">${esc(lib.note)}</p>
        </article>`;
}).join('');

const html = `<title>Sparkline Library Teardown</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=JetBrains+Mono:wght@400;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">
<style>
:root {
  --ground: #f7f8fb;
  --surface: #ffffff;
  --sunken: #eef0f6;
  --ink: #141824;
  --muted: #5f6678;
  --rule: #dfe3ec;
  --accent: #4f6bed;
  --native: #0e7c56;
  --native-bg: #dff3e9;
  --vector: #a66a00;
  --vector-bg: #fbeed2;
  --raster: #c0392b;
  --raster-bg: #fbdedb;
  --display: Archivo, "Helvetica Neue", Arial, sans-serif;
  --body: "Source Serif 4", Georgia, "Times New Roman", serif;
  --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --z: 1;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #12141a;
    --surface: #1a1d26;
    --sunken: #22262f;
    --ink: #e8eaf0;
    --muted: #9aa2b8;
    --rule: #2e323d;
    --accent: #8298f4;
    --native: #5ed3a0;
    --native-bg: #10321f;
    --vector: #e0a94a;
    --vector-bg: #372709;
    --raster: #f28b80;
    --raster-bg: #3a1a17;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --ground: #12141a;
  --surface: #1a1d26;
  --sunken: #22262f;
  --ink: #e8eaf0;
  --muted: #9aa2b8;
  --rule: #2e323d;
  --accent: #8298f4;
  --native: #5ed3a0;
  --native-bg: #10321f;
  --vector: #e0a94a;
  --vector-bg: #372709;
  --raster: #f28b80;
  --raster-bg: #3a1a17;
  color-scheme: dark;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: var(--body);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

.wrap { max-width: 1080px; margin: 0 auto; padding: 56px 28px 80px; }

/* ---- masthead ---- */
.mast { display: flex; flex-direction: column; gap: 18px; padding-bottom: 32px; border-bottom: 2px solid var(--ink); }
.eyebrow {
  font-family: var(--mono); font-size: 11px; font-weight: 600;
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); margin: 0;
}
h1 {
  font-family: var(--display); font-weight: 700; font-size: clamp(34px, 5.5vw, 54px);
  line-height: 1.02; letter-spacing: -0.028em; margin: 0; text-wrap: balance; max-width: 16ch;
}
.standfirst { margin: 0; max-width: 62ch; font-size: 18px; color: var(--muted); }
.standfirst strong { color: var(--ink); font-weight: 600; }

/* ---- specimen table ---- */
.tablehead {
  display: flex; flex-wrap: wrap; gap: 16px 24px; align-items: flex-end;
  justify-content: space-between; margin: 44px 0 14px;
}
h2 {
  font-family: var(--display); font-weight: 600; font-size: 21px;
  letter-spacing: -0.015em; margin: 0;
}
.tablehead p { margin: 4px 0 0; font-size: 14px; color: var(--muted); max-width: 54ch; }

.zoom { display: flex; align-items: center; gap: 10px; }
.zoom button {
  font-family: var(--mono); font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; padding: 9px 14px; border-radius: 4px; cursor: pointer;
  border: 1px solid var(--rule); background: var(--surface); color: var(--muted);
  transition: color .12s, border-color .12s, background .12s;
}
.zoom button:hover { color: var(--ink); border-color: var(--muted); }
.zoom button[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: var(--ground); }
.zoom button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.specimens { border-top: 1px solid var(--rule); }

.colhead {
  display: grid; grid-template-columns: var(--cols); gap: 0 22px; align-items: end;
  padding: 12px 0 10px; border-bottom: 1px solid var(--rule);
  font-family: var(--mono); font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.11em; text-transform: uppercase; color: var(--muted);
}
.colhead span:nth-child(3) { text-align: right; }

:root { --cols: minmax(160px, 1.15fr) minmax(300px, 2fr) 118px 128px; }

.spec {
  display: grid; grid-template-columns: var(--cols); gap: 0 22px; align-items: center;
  padding: 18px 0; border-bottom: 1px solid var(--rule);
}
.spec__id h3 {
  font-family: var(--display); font-weight: 600; font-size: 16.5px;
  letter-spacing: -0.012em; margin: 0 0 2px;
}
.spec__pkg { font-family: var(--mono); font-size: 11px; color: var(--muted); margin: 0; }

.spec__viz { display: flex; gap: 14px; flex-wrap: wrap; }
.viz {
  width: 277px; height: calc(53px * var(--z)); flex: 0 0 auto;
  display: flex; align-items: center; justify-content: flex-start;
  overflow: hidden; background: var(--surface);
  border: 1px solid var(--rule); border-radius: 3px;
  transition: height .22s ease;
}
.viz__in {
  transform: scale(var(--z)); transform-origin: left center;
  line-height: 0; flex: 0 0 auto;
}
.viz__in img { display: block; image-rendering: auto; }
/* ECharts ships its root <svg> with position:absolute, which would otherwise
   escape this flex container and leave the specimen box empty. */
.viz__in > svg { position: static; display: block; }

.spec__cost { text-align: right; }
.cost__num {
  display: block; font-family: var(--mono); font-size: 17px; font-weight: 600;
  font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
}
.cost__unit { font-size: 10.5px; font-weight: 400; color: var(--muted); margin-left: 3px; }
.cost__bar {
  display: block; height: 3px; margin-top: 6px; border-radius: 2px;
  background: var(--sunken); overflow: hidden;
}
.cost__bar i { display: block; height: 100%; background: var(--accent); border-radius: 2px; }

.pill {
  display: inline-block; font-family: var(--mono); font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.05em; padding: 5px 10px; border-radius: 3px; white-space: nowrap;
}
.pill--native { background: var(--native-bg); color: var(--native); }
.pill--vector { background: var(--vector-bg); color: var(--vector); }
.pill--raster { background: var(--raster-bg); color: var(--raster); }

.spec__note {
  grid-column: 1 / -1; margin: 12px 0 0; font-size: 14.5px;
  color: var(--muted); max-width: 78ch;
}
.spec--native { border-left: 3px solid var(--native); padding-left: 16px; margin-left: -19px; }

/* ---- tiers ---- */
.tiers { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); margin-top: 18px; }
.tier { padding: 18px 20px; background: var(--surface); border: 1px solid var(--rule); border-radius: 5px; }
.tier h3 { margin: 0 0 8px; font-family: var(--display); font-size: 15px; font-weight: 600; }
.tier p { margin: 0; font-size: 14px; color: var(--muted); }
.tier dl {
  margin: 12px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 3px 10px;
  font-family: var(--mono); font-size: 11.5px;
}
.tier dt { color: var(--muted); }
.tier dd { margin: 0; font-weight: 600; }

/* ---- prose + verdict ---- */
.prose { max-width: 66ch; margin-top: 48px; }
.prose h2 { margin-bottom: 10px; }
.prose p { margin: 0 0 14px; }
.prose code {
  font-family: var(--mono); font-size: 13px; background: var(--sunken);
  padding: 1px 5px; border-radius: 3px;
}

.verdict {
  margin-top: 44px; padding: 26px 28px; border-radius: 6px;
  background: var(--surface); border: 1px solid var(--rule); border-left: 3px solid var(--accent);
  max-width: 70ch;
}
.verdict h2 { margin-bottom: 8px; }
.verdict p { margin: 0 0 12px; }
.verdict p:last-child { margin-bottom: 0; }

.term {
  margin-top: 40px; padding: 20px 22px; border-radius: 6px; overflow-x: auto;
  background: var(--surface); border: 1px solid var(--rule);
  font-family: var(--mono); font-size: 12px; line-height: 1.85; color: var(--muted);
}
.term b { color: var(--native); font-weight: 600; }
.term em { color: var(--ink); font-style: normal; }

footer {
  margin-top: 52px; padding-top: 22px; border-top: 1px solid var(--rule);
  font-family: var(--mono); font-size: 11.5px; color: var(--muted);
  display: flex; flex-wrap: wrap; gap: 8px 20px;
}
footer a { color: var(--accent); }

@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }

@media (max-width: 860px) {
  :root { --cols: 1fr; }
  .colhead { display: none; }
  .spec { gap: 14px 0; padding: 22px 0; }
  .spec__cost { text-align: left; }
  .cost__bar { max-width: 200px; }
  .spec--native { margin-left: 0; }
}
</style>

<div class="wrap">
  <header class="mast">
    <p class="eyebrow">Seven libraries · one metric card · one PowerPoint export</p>
    <h1>Sparkline Library Teardown</h1>
    <p class="standfirst">
      The same twelve-month metric card, drawn by seven JavaScript chart libraries and
      measured on two axes: what it costs to ship, and what survives a trip into a deck.
      <strong>No web charting library exports PPTX</strong> — every pipeline ends at PNG, SVG or
      PDF — so the question is not which one exports best, but which one you can rebuild
      natively on the other side.
    </p>
  </header>

  <div class="tablehead">
    <div>
      <h2>The specimens</h2>
      <p>Real output captured from each library in Chromium — SVG inlined as vector, canvas as the bitmap it is. Two series each: one rising, one falling.</p>
    </div>
    <div class="zoom">
      <button id="zoomBtn" type="button" aria-pressed="false">Inspect at 300%</button>
    </div>
  </div>

  <section class="specimens" id="specimens">
    <div class="colhead">
      <span>Library</span><span>Rendered output</span><span>Cost (gzip)</span><span>Export fidelity</span>
    </div>
${rows}
  </section>

  <div class="tablehead"><div><h2>What "fidelity" means here</h2>
  <p>Three genuinely different outcomes for whoever opens the deck.</p></div></div>

  <div class="tiers">
    <div class="tier">
      <h3><span class="pill pill--native">Native chart</span></h3>
      <p>An OOXML chart part with an embedded workbook. The recipient can restyle it to their template, recolour it, or fix a number.</p>
      <dl><dt>Editable</dt><dd>Yes — right-click → Edit Data</dd><dt>Zoom</dt><dd>Stays sharp</dd></dl>
    </div>
    <div class="tier">
      <h3><span class="pill pill--vector">Vector image</span></h3>
      <p>SVG embedded as a picture. Sharp at any size, but frozen — no data behind it, and PowerPoint 2016+ or M365 only.</p>
      <dl><dt>Editable</dt><dd>No</dd><dt>Zoom</dt><dd>Stays sharp</dd></dl>
    </div>
    <div class="tier">
      <h3><span class="pill pill--raster">Raster only</span></h3>
      <p>A PNG of a canvas. Canvas has no DOM to read back, so a screenshot is the only thing that can leave the page.</p>
      <dl><dt>Editable</dt><dd>No</dd><dt>Zoom</dt><dd>Blurs — press the button above</dd></dl>
    </div>
  </div>

  <div class="verdict">
    <h2>The recommendation is the boring one</h2>
    <p>
      For a sparkline — a polyline and a flat average — a charting library buys nothing and
      costs fidelity. Every feature it offers is something OOXML cannot express, so the
      export becomes a picture of a chart rather than a chart.
    </p>
    <p>
      Hand-rolled SVG is 2 KB, matches the exported slide exactly, and is the only row above
      with a native export. Reach for a real library when the cards grow interaction — uPlot
      for very large series, ECharts for a full dashboard — and accept that those views leave
      the page as images.
    </p>
  </div>

  <section class="prose">
    <h2>Why the export is a rewrite, not an export</h2>
    <p>
      The card is rendered twice from one spec. The browser draws it in the DOM;
      <code>PptxGenJS</code> composes the same card from primitives PowerPoint owns natively — a
      rounded rectangle, three text runs, and one real chart part per card.
    </p>
    <p>
      Design tokens live in <em>points</em>, not pixels, because PPTX is a point-based format
      and the browser is the side that adapts. Both renderers share one y-domain, so every
      library above — and PowerPoint — scales the line identically. Without that, each picks
      its own "nice" bounds and the shapes drift apart.
    </p>
  </section>

  <div class="term">
    <div><em>$ npm run verify:pptx</em></div>
    <div><b>PASS</b>&nbsp; one native chart part per card &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;6 chart part(s) for 6 card(s)</div>
    <div><b>PASS</b>&nbsp; no rasterized media in the deck &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ppt/media is empty</div>
    <div><b>PASS</b>&nbsp; charts carry an embedded workbook &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;6 embedded workbook(s)</div>
    <div><b>PASS</b>&nbsp; average line is dashed in the XML &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;6/6</div>
    <div><b>PASS</b>&nbsp; card frames are native roundRect shapes &nbsp;&nbsp;6 roundRect shape(s)</div>
    <div><b>PASS</b>&nbsp; card text is real text, not outlines &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;found &lt;a:t&gt; runs</div>
    <div style="margin-top:10px">A single file in <em>ppt/media</em> would mean something got rasterized on the way out.</div>
  </div>

  <footer>
    <span>github.com/andrey-usa/charts</span>
    <span>Sizes measured via <em>npm run measure:bundles</em>, React excluded</span>
    <span>Specimens captured in Chromium at 3× DPR</span>
  </footer>
</div>

<script>
(function () {
  var btn = document.getElementById('zoomBtn');
  var root = document.documentElement;
  btn.addEventListener('click', function () {
    var on = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', String(!on));
    root.style.setProperty('--z', on ? '1' : '3');
    btn.textContent = on ? 'Inspect at 300%' : 'Back to 100%';
  });
})();
</script>
`;

await writeFile(OUT, html);
console.log(`wrote ${OUT} (${(html.length / 1024).toFixed(0)} KB)`);
