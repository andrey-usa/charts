# charts

Ten metric cards — current value, month-over-month delta with a direction triangle,
12-month sparkline against its average, legend and timeframe — rendered by seven chart
libraries and exported to PowerPoint three different ways, with the export measured.

```bash
npm install
npm run dev                # the showcase
npm run bench:export       # 7 libraries x 3 strategies: timings, decks, rendered slides
npm run verify:pptx        # prove the native export is native, without opening PowerPoint
npm run verify:renderers   # drive every library in Chromium and check it drew
npm run measure:bundles    # what each library actually costs
```

## The finding

**No web charting library exports PPTX.** Highcharts, ECharts, amCharts, Chart.js, Plotly,
Recharts, AnyChart — every export pipeline terminates at PNG, JPEG, SVG or PDF.

So the export here is not an export. It's a **second render of the same spec** through a
PPTX writer ([PptxGenJS](https://github.com/gitbrent/PptxGenJS)).

## Three export strategies

| Strategy | What lands in the deck | Editable | Survives zoom | Needs |
| --- | --- | --- | --- | --- |
| `native` | An OOXML chart part with an embedded workbook | Yes — Edit Data | Yes | Nothing but the data |
| `vector` | An SVG blip with a PNG fallback, PowerPoint's own vector format | No | Yes | SVG output + PowerPoint 2016+ |
| `raster` | A 3× PNG | No | No | Anything |

**Only the sparkline changes between them.** The card frame, label, value, delta triangle,
legend and timeframe are native PowerPoint shapes and text runs under every strategy. That
keeps the comparison to one variable, and means even a rasterized deck has selectable,
restyleable, screen-reader-readable text.

## Measured export times

Median of 3 runs, in Chromium, 10 cards across 2 slides. `npm run bench:export` regenerates.

| Library | Strategy | Capture | Compose | Serialize | **Total** | Size |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Hand-rolled SVG | native | 0 | 1 | 43 | **44 ms** | 433 KB |
| Hand-rolled SVG | vector | 5 | 2 | 11 | **18 ms** | 180 KB |
| Hand-rolled SVG | raster | 26 | 2 | 13 | **41 ms** | 290 KB |
| uPlot | native | 0 | 1 | 48 | **49 ms** | 433 KB |
| uPlot | raster | 2 | 1 | 13 | **16 ms** | 212 KB |
| Apache ECharts | vector | 6 | 2 | 12 | **20 ms** | 188 KB |
| Chart.js | raster | 2 | 1 | 13 | **16 ms** | 221 KB |

Two things the numbers say. **Native costs ~3× the time and ~2× the size** of the image
strategies — every chart part carries its own embedded workbook, and that is exactly what
buys "Edit Data". And **capture is nearly free for canvas** (`canvas.toDataURL` is 2 ms)
but real for SVG, which has to be serialized and, for raster, drawn through an offscreen
canvas first.

At 16–58 ms for ten cards, none of this is a bottleneck. Pick on fidelity, not speed.

## The reusable export

```ts
import { exportMetricDeck } from './src/pptx/export';
import { captureFor } from './src/pptx/capture';

const { data, timings, slides } = await exportMetricDeck({
  cards,                          // MetricCardSpec[] — the single source of truth
  strategy: 'native',             // 'native' | 'vector' | 'raster'
  capture: captureFor('vector'),  // only for vector/raster; reads the live DOM
  title: 'Metric cards',
  subtitle: 'Trailing 12 months',
  columns: 3,                     // optional; defaults to what fits the slide
});
// timings: { captureMs, composeMs, serializeMs, totalMs }
```

Three decisions carry the weight:

- **Tokens live in points**, not pixels (`src/core/tokens.ts`), because PPTX is a
  point-based format. The browser converts at 96/72; PowerPoint uses them directly. Row
  offsets are shared, so both renderers stack the card identically.
- **The card chrome is one function** with a pluggable sparkline slot
  (`addCardChrome` + `SparklineFill`), so a fourth strategy touches one place.
- **Capture is timed separately from composition**, so the cost of reading pixels out of
  the DOM is attributed to the strategies that actually pay it.

Asking for `vector` without a `capture` function throws with a message naming the fix,
rather than silently producing a deck of blank rectangles. `downloadMetricDeck` is the
browser entry point; `exportMetricDeck` returns bytes for Node and benchmarks.

## Library comparison

Sizes measured by `npm run measure:bundles` — each renderer bundled standalone, React
excluded, gzipped.

| Library | Renders as | Cost (gzip) | Best export | Notes |
| --- | --- | ---: | --- | --- |
| Hand-rolled SVG (`d3-shape`) | SVG | **2 KB** | native | Two paths and a line. Every primitive maps onto something OOXML has. |
| visx | SVG (React) | 15 KB | vector | d3 maths, React rendering. No abstraction to fight — hence the most code. |
| uPlot | Canvas | 23 KB | raster | Fastest here, and right for very large series. Canvas is a one-way door. |
| Chart.js | Canvas | 51 KB | raster | Ubiquitous and easy. A slide can hold a screenshot of it and nothing better. |
| Observable Plot | SVG | 93 KB | vector | Grammar of graphics — three marks and it's done. |
| Recharts | SVG (React) | 107 KB | vector | The React default. Most of the work is turning its opinions off. |
| Apache ECharts | SVG | 373 KB | vector | Enormous feature surface, 160× the baseline for twelve points. |

**The recommendation is the boring one.** For a sparkline, a charting library buys nothing
and costs fidelity: every feature it offers is something OOXML cannot express. Reach for a
real library when the cards grow interaction — and accept that those views export as images.

## Architecture

```
src/
  core/
    tokens.ts     design tokens in POINTS, with per-row card offsets
    types.ts      MetricCardSpec + ExportStrategy — consumed by both renderers
    stats.ts      average, delta, sentiment, value/duration formatting, timeframe
    data.ts       deterministic 12-month mock series for 10 metrics
  renderers/      one sparkline per library, identical props, code-split
  pptx/
    card.ts       card chrome + native chart / image sparkline
    export.ts     the reusable API: strategies, pagination, timings
    capture.ts    reads the live DOM for the vector and raster strategies
  ui/             card shell and comparison table
scripts/
  bench-export.mjs     the timing matrix; renders every deck through LibreOffice
  verify-pptx.ts       opens the .pptx as a zip and asserts on the OOXML inside
  verify-renderers.mjs drives every library in Chromium, then clicks Export for real
  measure-bundles.mjs  per-library gzipped cost
  build-lab.mjs        generates the comparison page from the benchmark run
```

Both renderers read `plotDomain()` from `tokens.ts`, so every library — and PowerPoint —
scales the line identically. Without it, each picks its own "nice" bounds and shapes drift.

## Verification

Claims are checked, not asserted. `npm run verify:pptx` opens the deck as a zip:

```
PASS  one native chart part per card              10 chart part(s) for 10 card(s)
PASS  no rasterized media in the deck             ppt/media is empty
PASS  charts carry an embedded workbook           10 embedded workbook(s)
PASS  exactly one delta triangle per card         10 triangle glyph(s) for 10 card(s)
PASS  delta text is colour-coded by sentiment     9 green + 1 red delta run(s)
PASS  legend keys are native shapes               legend labels present
PASS  timeframe caption is on every card          10 timeframe caption(s)
PASS  card frames are native roundRect shapes     10 across 2 slide(s)
```

Three bugs these caught, all invisible on screen until asserted:

- **`▲▲ 6.2%`** — `formatDelta` and the card were each prefixing the arrow. The check was
  `>= cards.length`; it is now exact equality.
- **Slide-1-only counting** — once the deck paginated, the roundRect check read one slide
  and undercounted. It now spans all slides.
- **Recharts drew no trend line** — `<Line>` inside `<AreaChart>` is silently dropped; it
  needs `ComposedChart`. `verify:renderers` now requires all three marks on an SVG sparkline.

## Known caveats

- **Fonts.** The deck uses Aptos, which ships with current Office. A brand font needs
  embedding and falls back where it is missing, reflowing the value block.
- **`lineSmooth` is off** on both sides. PowerPoint's spline is not `d3.curveCatmullRom`,
  so straight segments are the only setting that matches exactly.
- **Slide images** in the comparison page are rendered by LibreOffice Impress, a faithful
  but not pixel-identical OOXML renderer. PowerPoint itself may differ in font hinting.
- **`npm audit`** reports a DoS advisory in `image-size`, transitive via PptxGenJS and
  reachable only through its ICNS/JXL/HEIF parsers. The only offered fix downgrades
  PptxGenJS to before it had chart support.

## If you need to match a corporate template

Swap PptxGenJS for [pptx-automizer](https://github.com/singerla/pptx-automizer): design the
card once in PowerPoint, and code clones the slide and injects data into the existing chart.
Node-only, but it guarantees house style because the house designed it.
