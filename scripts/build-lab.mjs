/**
 * Generates the export-lab comparison page from the benchmark run.
 *
 * Everything on the page is measured output: the screenshots are real renders,
 * the slide images come from LibreOffice opening the actual .pptx files, and the
 * timings are medians from the browser running the same code the Export button does.
 */
import { readFile, writeFile } from 'node:fs/promises';

const OUT = process.argv[2];
const bench = JSON.parse(await readFile(new URL('../dist-verify/bench.json', import.meta.url)));
const images = JSON.parse(await readFile(new URL('../dist-verify/images.json', import.meta.url)));

const STRATEGY = {
  native: {
    name: 'Native chart',
    tier: 'native',
    blurb: 'Rebuilt as an OOXML chart part. Editable in PowerPoint, vector, with a working data sheet behind it.',
  },
  vector: {
    name: 'Vector image',
    tier: 'vector',
    blurb: "The library's own SVG, embedded the way PowerPoint stores vector art — an SVG blip with a PNG fallback. Pixel-identical, frozen.",
  },
  raster: {
    name: 'Raster image',
    tier: 'raster',
    blurb: 'A 3× PNG of the rendered chart. The only route for canvas libraries, and it blurs when anyone zooms.',
  },
};

const libs = [...new Set(bench.results.map((r) => r.library))].map((name) => {
  const rows = bench.results.filter((r) => r.library === name);
  return { name, slug: rows[0].slug, strategies: rows.map((r) => r.strategy) };
});

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ms = (n) => n.toFixed(0);
const kb = (n) => (n / 1024).toFixed(0);
const maxTotal = Math.max(...bench.results.map((r) => r.timings.totalMs));

const payload = {
  results: bench.results.map((r) => ({
    library: r.library, slug: r.slug, strategy: r.strategy,
    t: r.timings, bytes: r.bytes, slides: r.slides, retained: r.retained,
  })),
  libs,
  images,
};

const matrixRows = bench.results
  .map((r) => {
    const t = r.timings;
    const retained =
      r.retained.charts > 0
        ? `${r.retained.charts} chart parts`
        : r.retained.svgMedia > 0
          ? `${r.retained.svgMedia} SVG + ${r.retained.pngMedia} PNG fallback`
          : `${r.retained.pngMedia} PNG`;
    return `<tr data-lib="${esc(r.slug)}" data-strat="${r.strategy}">
      <td><strong>${esc(r.library)}</strong></td>
      <td><span class="pill pill--${STRATEGY[r.strategy].tier}">${STRATEGY[r.strategy].name}</span></td>
      <td class="num">${ms(t.captureMs)}</td>
      <td class="num">${ms(t.composeMs)}</td>
      <td class="num">${ms(t.serializeMs)}</td>
      <td class="num total"><span class="bar"><i style="width:${(t.totalMs / maxTotal) * 100}%"></i></span>${ms(t.totalMs)} ms</td>
      <td class="num">${kb(r.bytes)} KB</td>
      <td class="muted">${retained}</td>
    </tr>`;
  })
  .join('');

const libButtons = libs
  .map((l, i) => `<button type="button" role="tab" data-lib="${esc(l.slug)}" aria-selected="${i === 0}">${esc(l.name)}</button>`)
  .join('');

const stratButtons = Object.entries(STRATEGY)
  .map(([k, v], i) => `<button type="button" role="tab" data-strat="${k}" aria-selected="${i === 0}">${esc(v.name)}</button>`)
  .join('');

const html = `<title>Metric Card Export Lab</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=JetBrains+Mono:wght@400;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">
<style>
:root {
  --ground:#f7f8fb; --surface:#fff; --sunken:#eef0f6; --ink:#141824; --muted:#5f6678;
  --rule:#dfe3ec; --accent:#4f6bed;
  --native:#0e7c56; --native-bg:#dff3e9;
  --vector:#a66a00; --vector-bg:#fbeed2;
  --raster:#c0392b; --raster-bg:#fbdedb; --active-row:#f0f3fe;
  --display:Archivo,"Helvetica Neue",Arial,sans-serif;
  --body:"Source Serif 4",Georgia,"Times New Roman",serif;
  --mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  color-scheme:light;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ground:#12141a; --surface:#1a1d26; --sunken:#22262f; --ink:#e8eaf0; --muted:#9aa2b8;
  --rule:#2e323d; --accent:#8298f4;
  --native:#5ed3a0; --native-bg:#10321f; --vector:#e0a94a; --vector-bg:#372709;
  --raster:#f28b80; --raster-bg:#3a1a17; --active-row:#1e2333; color-scheme:dark;}}
:root[data-theme="dark"]{
  --ground:#12141a; --surface:#1a1d26; --sunken:#22262f; --ink:#e8eaf0; --muted:#9aa2b8;
  --rule:#2e323d; --accent:#8298f4;
  --native:#5ed3a0; --native-bg:#10321f; --vector:#e0a94a; --vector-bg:#372709;
  --raster:#f28b80; --raster-bg:#3a1a17; --active-row:#1e2333; color-scheme:dark;}

*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--body);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:52px 26px 80px}

.mast{display:flex;flex-direction:column;gap:16px;padding-bottom:28px;border-bottom:2px solid var(--ink)}
.eyebrow{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin:0}
h1{font-family:var(--display);font-weight:700;font-size:clamp(32px,5vw,50px);line-height:1.03;letter-spacing:-.028em;margin:0;text-wrap:balance;max-width:18ch}
.standfirst{margin:0;max-width:64ch;font-size:17.5px;color:var(--muted)}
.standfirst strong{color:var(--ink);font-weight:600}

h2{font-family:var(--display);font-weight:600;font-size:21px;letter-spacing:-.015em;margin:0}
.sec{margin-top:44px}
.sec__head{margin-bottom:14px}
.sec__head p{margin:5px 0 0;color:var(--muted);font-size:14.5px;max-width:62ch}

.controls{display:flex;flex-wrap:wrap;gap:18px 28px;margin-top:26px}
.ctrl{display:flex;flex-direction:column;gap:7px}
.ctrl__label{font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.tabs{display:flex;flex-wrap:wrap;gap:4px;padding:4px;background:var(--surface);border:1px solid var(--rule);border-radius:9px}
.tabs button{font-family:var(--display);font-size:13px;font-weight:500;border:0;background:transparent;color:var(--muted);padding:7px 13px;border-radius:6px;cursor:pointer}
.tabs button:hover:not(:disabled){color:var(--ink)}
.tabs button[aria-selected="true"]{background:var(--accent);color:#fff}
.tabs button:disabled{opacity:.34;cursor:not-allowed}
.tabs button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

.readout{display:flex;flex-wrap:wrap;gap:0;margin:24px 0 0;border:1px solid var(--rule);border-radius:10px;background:var(--surface);overflow:hidden;width:fit-content}
.readout div{display:flex;flex-direction:column;gap:2px;padding:11px 20px;border-right:1px solid var(--rule)}
.readout div:last-child{border-right:0}
.readout dt{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600}
.readout dd{margin:0;font-family:var(--mono);font-size:16px;font-weight:600;font-variant-numeric:tabular-nums}
.readout .hero-num dd{color:var(--accent)}

.panel{margin-top:22px;border:1px solid var(--rule);border-radius:12px;background:var(--surface);overflow:hidden}
.panel__bar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:baseline;justify-content:space-between;padding:13px 18px;border-bottom:1px solid var(--rule);background:var(--sunken)}
.panel__title{font-family:var(--display);font-weight:600;font-size:14.5px;margin:0}
.panel__note{font-family:var(--mono);font-size:11px;color:var(--muted);margin:0}
.panel__body{padding:18px;display:flex;flex-direction:column;gap:16px}
.panel__body img{width:100%;height:auto;display:block;border-radius:6px;border:1px solid var(--rule)}
.slide-cap{font-family:var(--mono);font-size:10.5px;color:var(--muted);margin:0 0 6px}

.pill{display:inline-block;font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.04em;padding:4px 9px;border-radius:3px;white-space:nowrap}
.pill--native{background:var(--native-bg);color:var(--native)}
.pill--vector{background:var(--vector-bg);color:var(--vector)}
.pill--raster{background:var(--raster-bg);color:var(--raster)}

.table-wrap{overflow-x:auto;margin-top:14px}
table{width:100%;min-width:920px;border-collapse:collapse;background:var(--surface);border:1px solid var(--rule);border-radius:10px;font-size:13px}
th,td{text-align:left;padding:10px 13px;border-bottom:1px solid var(--rule);vertical-align:middle}
thead th{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600}
tbody tr:last-child td{border-bottom:0}
tbody tr.is-active{background:var(--active-row)}
.num{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
.total{font-weight:600}
.bar{display:inline-block;width:52px;height:3px;background:var(--sunken);border-radius:2px;margin-right:8px;vertical-align:middle;overflow:hidden}
.bar i{display:block;height:100%;background:var(--accent)}
.muted{color:var(--muted)}

.cards{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));margin-top:14px}
.card{padding:17px 19px;background:var(--surface);border:1px solid var(--rule);border-radius:9px}
.card h3{margin:0 0 8px;font-family:var(--display);font-size:14.5px;font-weight:600}
.card p{margin:0;font-size:14px;color:var(--muted)}

pre{margin:14px 0 0;padding:18px 20px;background:var(--surface);border:1px solid var(--rule);border-radius:9px;overflow-x:auto;font-family:var(--mono);font-size:12.5px;line-height:1.7}
code{font-family:var(--mono)}
.prose{max-width:66ch}
.prose p{margin:0 0 13px;color:var(--muted)}
.prose strong{color:var(--ink)}
.prose code{font-size:12.5px;background:var(--sunken);padding:1px 5px;border-radius:3px;color:var(--ink)}

footer{margin-top:52px;padding-top:20px;border-top:1px solid var(--rule);font-family:var(--mono);font-size:11px;color:var(--muted);display:flex;flex-wrap:wrap;gap:8px 22px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="wrap">
  <header class="mast">
    <p class="eyebrow">7 libraries · 3 export strategies · 19 measured combinations</p>
    <h1>Metric Card Export Lab</h1>
    <p class="standfirst">
      Ten metric cards — current value, month-over-month delta with a direction triangle,
      12-month sparkline against its average, legend and timeframe — drawn by seven chart
      libraries and exported to PowerPoint three different ways.
      <strong>Every slide image below is the real .pptx</strong>, opened and re-rendered, not a mockup.
    </p>
  </header>

  <div class="controls">
    <div class="ctrl">
      <span class="ctrl__label">Library</span>
      <div class="tabs" id="libTabs" role="tablist" aria-label="Chart library">${libButtons}</div>
    </div>
    <div class="ctrl">
      <span class="ctrl__label">Export strategy</span>
      <div class="tabs" id="stratTabs" role="tablist" aria-label="Export strategy">${stratButtons}</div>
    </div>
  </div>

  <dl class="readout" id="readout"></dl>
  <p class="sec__head" style="margin-top:14px"><span class="muted" id="stratBlurb"></span></p>

  <section class="sec">
    <div class="sec__head">
      <h2>Page 1 — on the web page</h2>
      <p>The ten cards as the browser draws them, using the selected library for the sparkline.</p>
    </div>
    <div class="panel">
      <div class="panel__bar">
        <p class="panel__title" id="webTitle">On the page</p>
        <p class="panel__note">Live DOM · interactive</p>
      </div>
      <div class="panel__body"><img id="webShot" alt="Metric cards as rendered in the browser"></div>
    </div>
  </section>

  <section class="sec">
    <div class="sec__head">
      <h2>Page 2 — inside the exported deck</h2>
      <p>The same ten cards after export, shown by opening the generated .pptx and rendering its slides. Interaction is gone; what is left is what the recipient gets.</p>
    </div>
    <div class="panel">
      <div class="panel__bar">
        <p class="panel__title" id="deckTitle">In the exported deck</p>
        <p class="panel__note" id="deckNote"></p>
      </div>
      <div class="panel__body" id="deckShots"></div>
    </div>
  </section>

  <section class="sec">
    <div class="sec__head">
      <h2>Export timing matrix</h2>
      <p>Median of ${bench.runs} runs per combination, measured in the browser on the real export path. Ten cards, two slides.</p>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Library</th><th>Strategy</th>
          <th class="num">Capture</th><th class="num">Compose</th><th class="num">Serialize</th>
          <th class="num">Total</th><th class="num">Size</th><th>What is in the file</th>
        </tr></thead>
        <tbody id="matrix">${matrixRows}</tbody>
      </table>
    </div>
  </section>

  <section class="sec">
    <div class="sec__head"><h2>What each strategy keeps</h2></div>
    <div class="cards">
      <div class="card">
        <h3><span class="pill pill--native">Native chart</span></h3>
        <p>Right-click → Edit Data opens a real worksheet. Recolours with the deck theme, scales without loss, and the recipient can fix a number. The heaviest file, because each chart carries its own embedded workbook.</p>
      </div>
      <div class="card">
        <h3><span class="pill pill--vector">Vector image</span></h3>
        <p>Stored the way PowerPoint stores vector art — an SVG blip with a PNG fallback, so old versions still show something. Matches the screen exactly. No data behind it.</p>
      </div>
      <div class="card">
        <h3><span class="pill pill--raster">Raster image</span></h3>
        <p>A 3× PNG. The only option for canvas libraries. Fine on a projector, visibly soft the moment anyone zooms or prints.</p>
      </div>
    </div>
    <div class="prose" style="margin-top:18px">
      <p>
        One thing holds across all three: <strong>only the sparkline changes</strong>. The card frame,
        label, value, delta triangle, legend and timeframe are native PowerPoint shapes and text runs
        in every strategy. That keeps the comparison to a single variable — and means even a
        rasterized deck has selectable, restyleable, screen-reader-readable text.
      </p>
    </div>
  </section>

  <section class="sec">
    <div class="sec__head">
      <h2>The reusable export</h2>
      <p>One entry point, one options object, and the strategy is the only thing that varies.</p>
    </div>
    <pre><code>import { exportMetricDeck } from './pptx/export';
import { captureFor } from './pptx/capture';

const { data, timings, slides } = await exportMetricDeck({
  cards,                       // MetricCardSpec[] — the single source of truth
  strategy: 'native',          // 'native' | 'vector' | 'raster'
  capture: captureFor('vector'), // only for vector/raster; reads the live DOM
  title: 'Metric cards',
  subtitle: 'Trailing 12 months',
  columns: 3,                  // optional; defaults to what fits the slide
});

// timings: { captureMs, composeMs, serializeMs, totalMs }
// Pagination, grid centring and card composition are handled internally.</code></pre>
    <div class="prose" style="margin-top:16px">
      <p>
        Three design decisions carry most of the weight. <strong>Tokens live in points</strong>, not
        pixels, because PPTX is a point-based format — the browser is the side that converts.
        <strong>The card chrome is one function</strong> with a pluggable sparkline slot, so adding a
        fourth strategy touches one place. And <strong>capture is separated from composition</strong>
        in the timing, so the cost of reading pixels out of the DOM is attributed to the strategies
        that actually pay it.
      </p>
      <p>
        Asking for <code>vector</code> without a <code>capture</code> function throws with a message
        that names the fix, rather than silently producing a deck full of blank rectangles.
      </p>
    </div>
  </section>

  <footer>
    <span>github.com/andrey-usa/charts</span>
    <span>Timings: median of ${bench.runs}, Chromium, 10 cards</span>
    <span>Slides rendered via LibreOffice Impress</span>
  </footer>
</div>

<script id="payload" type="application/json">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script>
<script>
(function () {
  var DATA = JSON.parse(document.getElementById('payload').textContent);
  var BLURB = ${JSON.stringify(Object.fromEntries(Object.entries(STRATEGY).map(([k, v]) => [k, v.blurb])))};
  var NAMES = ${JSON.stringify(Object.fromEntries(Object.entries(STRATEGY).map(([k, v]) => [k, v.name])))};

  var libTabs = document.getElementById('libTabs');
  var stratTabs = document.getElementById('stratTabs');
  var state = { lib: DATA.libs[0].slug, strat: 'native' };

  function libOf(slug) { return DATA.libs.filter(function (l) { return l.slug === slug; })[0]; }
  function resultFor(slug, strat) {
    return DATA.results.filter(function (r) { return r.slug === slug && r.strategy === strat; })[0];
  }

  function render() {
    var lib = libOf(state.lib);

    // A canvas library has no SVG to embed, so vector is genuinely unavailable.
    Array.prototype.forEach.call(stratTabs.children, function (b) {
      var ok = lib.strategies.indexOf(b.dataset.strat) !== -1;
      b.disabled = !ok;
      b.title = ok ? '' : lib.name + ' renders to canvas — there is no SVG to embed.';
    });
    if (lib.strategies.indexOf(state.strat) === -1) state.strat = 'native';

    Array.prototype.forEach.call(libTabs.children, function (b) {
      b.setAttribute('aria-selected', String(b.dataset.lib === state.lib));
    });
    Array.prototype.forEach.call(stratTabs.children, function (b) {
      b.setAttribute('aria-selected', String(b.dataset.strat === state.strat));
    });

    var r = resultFor(state.lib, state.strat);
    document.getElementById('stratBlurb').textContent = BLURB[state.strat];

    document.getElementById('readout').innerHTML =
      '<div><dt>Capture</dt><dd>' + r.t.captureMs.toFixed(0) + ' ms</dd></div>' +
      '<div><dt>Compose</dt><dd>' + r.t.composeMs.toFixed(0) + ' ms</dd></div>' +
      '<div><dt>Serialize</dt><dd>' + r.t.serializeMs.toFixed(0) + ' ms</dd></div>' +
      '<div class="hero-num"><dt>Total export</dt><dd>' + r.t.totalMs.toFixed(0) + ' ms</dd></div>' +
      '<div><dt>File size</dt><dd>' + (r.bytes / 1024).toFixed(0) + ' KB</dd></div>';

    var web = document.getElementById('webShot');
    web.src = DATA.images['web-' + state.lib] || '';
    web.alt = 'Ten metric cards rendered in the browser using ' + lib.name;
    document.getElementById('webTitle').textContent = lib.name + ' — on the page';

    document.getElementById('deckTitle').textContent =
      lib.name + ' — ' + NAMES[state.strat] + ' export';
    document.getElementById('deckNote').textContent =
      r.slides + ' slide' + (r.slides === 1 ? '' : 's') + ' · ' + (r.bytes / 1024).toFixed(0) + ' KB · ' +
      r.t.totalMs.toFixed(0) + ' ms';

    var host = document.getElementById('deckShots');
    host.innerHTML = '';
    for (var i = 1; i <= r.slides; i++) {
      var key = 'pptx-' + state.lib + '-' + state.strat + '-' + i;
      if (!DATA.images[key]) continue;
      var wrap = document.createElement('div');
      var cap = document.createElement('p');
      cap.className = 'slide-cap';
      cap.textContent = 'Slide ' + i + ' of ' + r.slides;
      var img = document.createElement('img');
      img.src = DATA.images[key];
      img.alt = 'Slide ' + i + ' of the exported deck for ' + lib.name;
      img.loading = 'lazy';
      wrap.appendChild(cap);
      wrap.appendChild(img);
      host.appendChild(wrap);
    }

    Array.prototype.forEach.call(document.querySelectorAll('#matrix tr'), function (tr) {
      tr.classList.toggle('is-active', tr.dataset.lib === state.lib && tr.dataset.strat === state.strat);
    });
  }

  libTabs.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    state.lib = b.dataset.lib;
    render();
  });
  stratTabs.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.disabled) return;
    state.strat = b.dataset.strat;
    render();
  });
  document.getElementById('matrix').addEventListener('click', function (e) {
    var tr = e.target.closest('tr');
    if (!tr) return;
    state.lib = tr.dataset.lib;
    state.strat = tr.dataset.strat;
    render();
    document.querySelector('.controls').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  render();
})();
</script>
`;

await writeFile(OUT, html);
console.log(`wrote ${OUT} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
