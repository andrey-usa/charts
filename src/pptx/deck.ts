import PptxGenJS from 'pptxgenjs';
import { card, inchOf, palette, type } from '../core/tokens';
import type { MetricCardSpec } from '../core/types';
import { addMetricCard } from './card';

/** 16:9 widescreen, the PowerPoint default. */
const SLIDE_W_IN = 13.333;
const SLIDE_H_IN = 7.5;

const GRID_COLS = 3;
const GUTTER_IN = inchOf(20);

export interface DeckOptions {
  readonly title?: string;
  readonly subtitle?: string;
}

/**
 * Builds the deck in memory. Kept free of any DOM or filesystem call so the same
 * function runs in the browser (download) and in Node (the verification script).
 */
export function buildDeck(cards: readonly MetricCardSpec[], opts: DeckOptions = {}): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: SLIDE_W_IN, height: SLIDE_H_IN });
  pptx.layout = 'WIDE';
  pptx.author = 'charts';
  pptx.title = opts.title ?? 'Metric cards';

  const slide = pptx.addSlide();
  slide.background = { color: palette.pageBg };

  slide.addText(opts.title ?? 'Metric cards', {
    x: 0.6,
    y: 0.45,
    w: SLIDE_W_IN - 1.2,
    h: 0.4,
    fontFace: type.pptxFamily,
    fontSize: 22,
    bold: true,
    color: palette.value,
    margin: 0,
  });

  slide.addText(opts.subtitle ?? 'Trailing 12 months · dashed line is the period average', {
    x: 0.6,
    y: 0.88,
    w: SLIDE_W_IN - 1.2,
    h: 0.3,
    fontFace: type.pptxFamily,
    fontSize: 11,
    color: palette.label,
    margin: 0,
  });

  const cardW = inchOf(card.widthPt);
  const cardH = inchOf(card.heightPt);
  const rows = Math.ceil(cards.length / GRID_COLS);
  const gridW = GRID_COLS * cardW + (GRID_COLS - 1) * GUTTER_IN;
  const gridH = rows * cardH + (rows - 1) * GUTTER_IN;
  const originX = (SLIDE_W_IN - gridW) / 2;
  const originY = 1.45 + (SLIDE_H_IN - 1.45 - 0.5 - gridH) / 2;

  cards.forEach((spec, i) => {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    addMetricCard(pptx, slide, spec, {
      xIn: originX + col * (cardW + GUTTER_IN),
      yIn: originY + row * (cardH + GUTTER_IN),
    });
  });

  slide.addText(
    'Every element above is a native PowerPoint object — shapes, text and chart parts. Nothing is an image.',
    {
      x: 0.6,
      y: SLIDE_H_IN - 0.62,
      w: SLIDE_W_IN - 1.2,
      h: 0.3,
      fontFace: type.pptxFamily,
      fontSize: type.footnotePt,
      color: palette.label,
      margin: 0,
    },
  );

  return pptx;
}

/** Browser entry point: builds the deck and triggers a download. */
export async function downloadDeck(
  cards: readonly MetricCardSpec[],
  fileName = 'metric-cards.pptx',
  opts: DeckOptions = {},
): Promise<void> {
  const pptx = buildDeck(cards, opts);
  await pptx.writeFile({ fileName });
}
