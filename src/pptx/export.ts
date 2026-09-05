import PptxGenJS from 'pptxgenjs';
import { card, inchOf, palette, type } from '../core/tokens';
import type { ExportStrategy, MetricCardSpec } from '../core/types';
import { addMetricCard, type SparklineFill } from './card';

/**
 * How the sparkline reaches the slide.
 *
 * - `native`  — rebuilt as an OOXML chart part. Editable, vector, data-linked.
 *               Available for every library, because it needs only the data.
 * - `vector`  — the library's own SVG, embedded as a picture. Pixel-identical to
 *               the screen and sharp at any zoom, but frozen (PowerPoint 2016+).
 * - `raster`  — a PNG of the rendered chart. The only option for canvas libraries.
 */
export type { ExportStrategy } from '../core/types';

export interface SparklineCapture {
  readonly kind: 'svg' | 'png';
  /** A `data:` URI. PptxGenJS embeds it as an image part. */
  readonly dataUri: string;
}

/** Supplies the rendered sparkline for a card. Only needed for vector/raster. */
export type CaptureFn = (spec: MetricCardSpec) => Promise<SparklineCapture> | SparklineCapture;

export interface MetricDeckOptions {
  readonly cards: readonly MetricCardSpec[];
  readonly strategy: ExportStrategy;
  /** Required when strategy is `vector` or `raster`. */
  readonly capture?: CaptureFn;
  readonly title?: string;
  readonly subtitle?: string;
  /** Cards per row. Defaults to as many as fit the slide. */
  readonly columns?: number;
}

/** Wall-clock breakdown of one export, in milliseconds. */
export interface ExportTimings {
  /** Getting each library's rendered output. Zero for `native`. */
  readonly captureMs: number;
  /** Laying out shapes, text and charts into the presentation model. */
  readonly composeMs: number;
  /** Zipping the OOXML parts into the .pptx byte stream. */
  readonly serializeMs: number;
  readonly totalMs: number;
}

export interface MetricDeckResult {
  readonly timings: ExportTimings;
  readonly bytes: number;
  readonly slides: number;
  readonly strategy: ExportStrategy;
}

const SLIDE_W_IN = 13.333;
const SLIDE_H_IN = 7.5;
const MARGIN_IN = 0.55;
const GUTTER_IN = inchOf(18);
const HEADER_IN = 1.15;
const FOOTER_IN = 0.3;

const CARD_W_IN = inchOf(card.widthPt);
const CARD_H_IN = inchOf(card.heightPt);

/** How many whole cards fit across and down one slide. */
function gridCapacity(columns?: number): { cols: number; rows: number } {
  const usableW = SLIDE_W_IN - MARGIN_IN * 2;
  const usableH = SLIDE_H_IN - HEADER_IN - FOOTER_IN;
  const fitCols = Math.max(1, Math.floor((usableW + GUTTER_IN) / (CARD_W_IN + GUTTER_IN)));
  const rows = Math.max(1, Math.floor((usableH + GUTTER_IN) / (CARD_H_IN + GUTTER_IN)));
  return { cols: columns ?? fitCols, rows };
}

/**
 * Builds a metric-card deck, paginating across slides as needed.
 *
 * The strategy only decides what fills the sparkline slot — the frame, label,
 * timeframe, value, delta and legend are native PowerPoint objects in every case.
 * That is deliberate: it keeps the comparison honest (one variable) and means
 * even a rasterized deck keeps selectable, restyleable text.
 */
export async function composeMetricDeck(
  options: MetricDeckOptions,
): Promise<{ pptx: PptxGenJS; captureMs: number; composeMs: number; slides: number }> {
  const { cards, strategy, capture } = options;

  if (strategy !== 'native' && !capture) {
    throw new Error(
      `Strategy "${strategy}" needs a capture function to supply each library's rendered sparkline. ` +
        `Pass \`capture\`, or use strategy "native" which rebuilds the chart from the data.`,
    );
  }

  // 1 — capture. Kept separate from composition so the timing attributes the cost
  // of reading pixels/markup out of the DOM to the strategy that actually pays it.
  const captureStart = performance.now();
  const fills: SparklineFill[] = [];
  for (const spec of cards) {
    if (strategy === 'native') {
      fills.push({ kind: 'native' });
    } else {
      const shot = await capture!(spec);
      fills.push({ kind: 'image', dataUri: shot.dataUri });
    }
  }
  const captureMs = performance.now() - captureStart;

  // 2 — compose.
  const composeStart = performance.now();
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: SLIDE_W_IN, height: SLIDE_H_IN });
  pptx.layout = 'WIDE';
  pptx.author = 'charts';
  pptx.title = options.title ?? 'Metric cards';

  const { cols, rows } = gridCapacity(options.columns);
  const capacity = cols * rows;
  const slideCount = Math.max(1, Math.ceil(cards.length / capacity));
  // Spread cards evenly rather than filling each slide to capacity: 10 cards at a
  // capacity of 9 should read as 5 + 5, not 9 + 1.
  const perSlide = Math.ceil(cards.length / slideCount);

  const gridW = cols * CARD_W_IN + (cols - 1) * GUTTER_IN;
  const originX = (SLIDE_W_IN - gridW) / 2;

  for (let s = 0; s < slideCount; s++) {
    const slice = cards.slice(s * perSlide, (s + 1) * perSlide);
    const slide = pptx.addSlide();
    slide.background = { color: palette.pageBg };

    const heading = options.title ?? 'Metric cards';
    slide.addText(slideCount > 1 ? `${heading} (${s + 1}/${slideCount})` : heading, {
      x: MARGIN_IN,
      y: 0.34,
      w: SLIDE_W_IN - MARGIN_IN * 2,
      h: 0.36,
      fontFace: type.pptxFamily,
      fontSize: 20,
      bold: true,
      color: palette.value,
      margin: 0,
    });

    if (options.subtitle) {
      slide.addText(options.subtitle, {
        x: MARGIN_IN,
        y: 0.72,
        w: SLIDE_W_IN - MARGIN_IN * 2,
        h: 0.28,
        fontFace: type.pptxFamily,
        fontSize: 10.5,
        color: palette.label,
        margin: 0,
      });
    }

    // Centre the rows this slide actually uses, so a short last slide isn't top-heavy.
    const usedRows = Math.ceil(slice.length / cols);
    const gridH = usedRows * CARD_H_IN + (usedRows - 1) * GUTTER_IN;
    const originY = HEADER_IN + (SLIDE_H_IN - HEADER_IN - FOOTER_IN - gridH) / 2;

    slice.forEach((spec, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      addMetricCard(
        pptx,
        slide,
        spec,
        {
          xIn: originX + col * (CARD_W_IN + GUTTER_IN),
          yIn: originY + row * (CARD_H_IN + GUTTER_IN),
        },
        fills[s * perSlide + i]!,
      );
    });
  }

  return { pptx, captureMs, composeMs: performance.now() - composeStart, slides: slideCount };
}

/** Composes and serializes, reporting where the time went. Node-friendly. */
export async function exportMetricDeck(
  options: MetricDeckOptions,
): Promise<MetricDeckResult & { data: ArrayBuffer }> {
  const { pptx, captureMs, composeMs, slides } = await composeMetricDeck(options);

  const serializeStart = performance.now();
  const data = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
  const serializeMs = performance.now() - serializeStart;

  return {
    data,
    bytes: data.byteLength,
    slides,
    strategy: options.strategy,
    timings: {
      captureMs,
      composeMs,
      serializeMs,
      totalMs: captureMs + composeMs + serializeMs,
    },
  };
}

/** Browser entry point: builds the deck and hands the user a download. */
export async function downloadMetricDeck(
  options: MetricDeckOptions,
  fileName = 'metric-cards.pptx',
): Promise<MetricDeckResult> {
  const { pptx, captureMs, composeMs, slides } = await composeMetricDeck(options);

  const serializeStart = performance.now();
  await pptx.writeFile({ fileName });
  const serializeMs = performance.now() - serializeStart;

  return {
    bytes: 0,
    slides,
    strategy: options.strategy,
    timings: { captureMs, composeMs, serializeMs, totalMs: captureMs + composeMs + serializeMs },
  };
}
