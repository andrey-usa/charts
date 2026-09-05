# charts

Metric cards — sparkline, 12-month average line, current value with delta — rendered by
seven different chart libraries, and exported to PowerPoint as **native shapes, text and
chart parts**. Nothing in the exported deck is a screenshot.

```bash
npm install
npm run dev              # the showcase
npm run verify:pptx      # prove the export is native, without opening PowerPoint
npm run verify:renderers # drive every library in Chromium and check it drew
npm run measure:bundles  # what each library actually costs
```

## The finding

**No web charting library exports PPTX.** Highcharts, ECharts, amCharts, Chart.js, Plotly,
Recharts, AnyChart — every export pipeline terminates at PNG, JPEG, SVG or PDF. Whatever
they hand you lands in a deck as a picture, which blurs on zoom and can't be restyled,
recoloured or edited by whoever receives the file.

So the export here is not an export. It's a **second render of the same spec** through a
PPTX *writer* ([PptxGenJS](https://github.com/gitbrent/PptxGenJS)), which composes each
card from primitives PowerPoint owns natively:

| Card element | Web | PowerPoint |
| --- | --- | --- |
| Card frame | `<article>` + CSS | `addShape(roundRect)` |
| Label / value / delta | DOM text | `addText` — real text runs |
| Sparkline + average | `<svg>` or `<canvas>` | `addChart` — a real `c:chart` part |

## Three tiers of export fidelity

| Tier | What lands in the deck | Editable? | Survives zoom? |
| --- | --- | --- | --- |
| **Native chart** | An OOXML chart part with an embedded workbook | Yes — right-click → Edit Data | Yes |
| **Vector image** | SVG embedded as a picture (PowerPoint 2016+/M365 only) | No | Yes |
| **Raster** | A PNG of a canvas | No | No |

Only the first tier gives you a chart the recipient can recolour to their template,
restyle, or correct a number in. That is the tier this repo targets.

## Library comparison

Sizes are **measured**, not estimated — `npm run measure:bundles` bundles each renderer
standalone with React excluded and reports the gzipped result.

| Library | Renders as | Cost (gzip) | PPTX fidelity | Notes |
| --- | --- | ---: | --- | --- |
| Hand-rolled SVG (`d3-shape`) | SVG | **2 KB** | Native | Two paths and a line. Every primitive maps onto something OOXML has. |
| visx | SVG (React) | 15 KB | Vector image | Airbnb's d3-in-React primitives. No chart abstraction to fight — which is why the code is longest. |
| uPlot | Canvas | 23 KB | Raster | Fastest of the set and tiny for what it does, but canvas can only leave the page as pixels. |
| Chart.js | Canvas | 51 KB | Raster | Ubiquitous and easy. A slide can hold a screenshot of it and nothing better. |
| Observable Plot | SVG | 93 KB | Vector image | Grammar of graphics. The most expressive per line of code — three marks and it's done. |
| Recharts | SVG (React) | 107 KB | Vector image | The React default. Most of the work is turning its opinions off. |
| Apache ECharts | SVG | 373 KB | Vector image | Enormous feature surface, and 160× the baseline for a twelve-point line. |

**The recommendation is the boring one.** For a sparkline — a polyline and a flat average —
a charting library buys nothing and costs fidelity: every feature it offers is something
OOXML can't express. Hand-rolled SVG is 2 KB, matches the PPTX output exactly, and is the
only row in that table with a native export.

Reach for a real library when the cards grow interaction (uPlot for large series,
ECharts for a full dashboard) — and accept that those views export as pictures.

## Architecture

The point-based token file is what makes the two renders agree.

```
src/
  core/
    tokens.ts     design tokens in POINTS — PPTX is a point format, the browser adapts
    types.ts      MetricCardSpec — the single source both renderers consume
    stats.ts      average, delta, sentiment, value formatting
    data.ts       deterministic 12-month mock series
  renderers/      one sparkline per library, identical props, code-split
  pptx/
    card.ts       one card as native shapes + text + chart part
    deck.ts       slide layout; runs unchanged in browser and Node
  ui/             card shell and comparison table
scripts/
  verify-pptx.ts       opens the .pptx as a zip and asserts on the OOXML inside
  verify-renderers.mjs drives every library in Chromium, then clicks Export for real
  measure-bundles.mjs  per-library gzipped cost
```

Both renderers read `plotDomain()` from `tokens.ts`, so every library — and PowerPoint —
scales the line identically. Without that, each library picks its own "nice" bounds and
the shapes drift apart.

## Verification

The export claim is checked, not asserted. `npm run verify:pptx` builds the deck with the
same code the browser button uses, opens it as a zip, and asserts on the parts inside:

```
  PASS  one native chart part per card                         6 chart part(s) for 6 card(s)
  PASS  no rasterized media in the deck                        ppt/media is empty
  PASS  charts carry an embedded workbook ("Edit Data" works)  6 embedded workbook(s)
  PASS  every chart has a line plot                            6/6
  PASS  every chart has the area fill                          6/6
  PASS  average line is dashed in the XML                      6/6
  PASS  axes are deleted (sparkline look)                      6/6
  PASS  card frames are native roundRect shapes                6 roundRect shape(s)
  PASS  card text is real text, not outlines                   found <a:t> runs
```

A single file in `ppt/media` would mean something got rasterized on the way out.

`npm run verify:renderers` loads the production build in Chromium, switches to each
library, checks it actually drew (an SVG sparkline must carry all three marks — this
caught Recharts silently dropping its trend line), screenshots the grid, then clicks
**Export to PowerPoint** and inspects the downloaded file.

## Known caveats

- **Fonts.** The deck uses Aptos, which ships with current Office. A brand font would need
  embedding, and falls back on machines that lack it — reflowing the value block.
- **`lineSmooth` is off** on both sides. PowerPoint's spline is not `d3.curveCatmullRom`,
  so straight segments are the only setting that matches exactly.
- **Vector-image tier needs PowerPoint 2016+/M365.** Older versions won't render embedded SVG.
- **`npm audit`** reports a DoS advisory in `image-size`, a transitive dependency of
  PptxGenJS, reachable only through its ICNS/JXL/HEIF parsers. This project passes no
  images to PptxGenJS. The only offered "fix" is downgrading PptxGenJS to 1.1.5, which
  predates chart support.

## If you need to match a corporate template

Swap PptxGenJS for [pptx-automizer](https://github.com/singerla/pptx-automizer): you design
the card once in PowerPoint, and code clones the slide and injects data into the existing
chart. It's Node-only (no browser export), but it guarantees the deck matches house style
because the house designed it.
