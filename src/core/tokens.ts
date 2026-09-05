/**
 * Design tokens expressed in POINTS, because PPTX is a point/inch format and the
 * browser is the side that has to adapt. Every renderer, the web card and the
 * PPTX writer read from here, so a change lands in every output at once.
 */

/** CSS pixels per point (96dpi / 72pt). */
export const PX_PER_PT = 96 / 72;
/** Inches per point. */
export const IN_PER_PT = 1 / 72;

export const pxOf = (pt: number): number => pt * PX_PER_PT;
export const inchOf = (pt: number): number => pt * IN_PER_PT;

/**
 * Card geometry, in points, laid out top to bottom. The `y` values are offsets
 * from the card's top edge so the web and PPTX renderers place rows identically
 * instead of each doing its own stacking maths.
 */
export const card = {
  widthPt: 250,
  heightPt: 132,
  paddingPt: 14,
  radiusPt: 8,

  labelYPt: 14,
  labelHPt: 11,

  valueYPt: 27,
  valueHPt: 34,

  sparkYPt: 64,
  sparkHPt: 38,

  legendYPt: 106,
  legendHPt: 11,
} as const;

export const innerWidthPt = card.widthPt - card.paddingPt * 2;

export const type = {
  /** Must exist in PowerPoint or the exported deck reflows. */
  family: 'Aptos, Calibri, Segoe UI, system-ui, sans-serif',
  pptxFamily: 'Aptos',
  labelPt: 8.5,
  timeframePt: 7.5,
  valuePt: 25,
  deltaPt: 10,
  legendPt: 7.5,
  footnotePt: 7.5,
} as const;

/** Hex without `#` — PptxGenJS wants it that way; the web side prefixes it. */
export const palette = {
  cardBg: 'FFFFFF',
  cardBorder: 'E3E6EC',
  label: '6B7280',
  timeframe: '9AA3B2',
  value: '111827',
  line: '4F6BED',
  lineArea: 'DDE3FB',
  average: '9AA3B2',
  positive: '15803D',
  negative: 'B91C1C',
  neutral: '6B7280',
  pageBg: 'F4F5F8',
} as const;

export const web = (hex: string): string => `#${hex}`;

/** Vertical headroom added above/below the series so the line never touches the box. */
export const PLOT_PADDING_RATIO = 0.12;

/**
 * Shared y-domain so every renderer — and PowerPoint — scales the line the same
 * way. Without this each library picks its own "nice" bounds and the shapes drift.
 */
export function plotDomain(values: readonly number[], average: number): { min: number; max: number } {
  const all = [...values, average];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || Math.abs(hi) || 1;
  const pad = span * PLOT_PADDING_RATIO;
  return { min: lo - pad, max: hi + pad };
}

/** Legend copy, shared by the card chrome and the PPTX writer. */
export const legend = {
  actual: 'Actual',
  average: '12-mo avg',
} as const;
