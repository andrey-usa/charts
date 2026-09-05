import type PptxGenJS from 'pptxgenjs';
import { computeStats, deltaArrow, formatDelta, formatValue, monthLabel, timeframeLabel } from '../core/stats';
import { card, inchOf, innerWidthPt, legend, palette, plotDomain, type } from '../core/tokens';
import type { MetricCardSpec } from '../core/types';

/** How the sparkline slot gets filled. The rest of the card is identical either way. */
export type SparklineFill =
  | { readonly kind: 'native' }
  | { readonly kind: 'image'; readonly dataUri: string };

export interface CardPlacement {
  /** Top-left corner of the card, in inches. */
  readonly xIn: number;
  readonly yIn: number;
}

/**
 * PptxGenJS's multi-type chart form takes the options object as its SECOND
 * argument — the implementation reads `tmpOpt = data || opt` — but its bundled
 * .d.ts types that slot as `any[]`. The cast is wrong-shaped by declaration
 * only, so it is contained here rather than repeated at the call site.
 */
function addMultiChart(
  slide: PptxGenJS.Slide,
  groups: PptxGenJS.IChartMulti[],
  options: PptxGenJS.IChartOpts,
): void {
  slide.addChart(groups, options as unknown as unknown[]);
}

const deltaColorFor = (sentiment: 'positive' | 'negative' | 'neutral'): string =>
  sentiment === 'positive' ? palette.positive : sentiment === 'negative' ? palette.negative : palette.neutral;

/**
 * Everything on the card except the sparkline: frame, label, timeframe, value,
 * delta with its direction triangle, and the legend.
 *
 * All of it is native PowerPoint — a rounded rectangle, text runs and two line
 * shapes — so it stays vector and editable under every export strategy. Only the
 * sparkline slot differs, which is what makes the strategies comparable.
 */
export function addCardChrome(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: MetricCardSpec,
  place: CardPlacement,
): void {
  const stats = computeStats(spec);
  const padIn = inchOf(card.paddingPt);
  const innerIn = inchOf(innerWidthPt);

  slide.addShape(pptx.ShapeType.roundRect, {
    x: place.xIn,
    y: place.yIn,
    w: inchOf(card.widthPt),
    h: inchOf(card.heightPt),
    fill: { color: palette.cardBg },
    line: { color: palette.cardBorder, width: 0.75 },
    rectRadius: inchOf(card.radiusPt),
    shadow: { type: 'outer', color: '9AA3B2', opacity: 0.18, blur: 6, offset: 1.5, angle: 90 },
  });

  // The label owns the full row: at 8.5pt even "Customer acquisition cost" fits,
  // and sharing the row with the timeframe made longer labels wrap into the value.
  slide.addText(spec.label.toUpperCase(), {
    x: place.xIn + padIn,
    y: place.yIn + inchOf(card.labelYPt),
    w: innerIn,
    h: inchOf(card.labelHPt),
    fontFace: type.pptxFamily,
    fontSize: type.labelPt,
    color: palette.label,
    charSpacing: 0.6,
    align: 'left',
    valign: 'middle',
    margin: 0,
    fit: 'shrink',
  });

  // Current value (left) and month-over-month delta (right).
  slide.addText(formatValue(stats.current, spec.format), {
    x: place.xIn + padIn,
    y: place.yIn + inchOf(card.valueYPt),
    w: innerIn * 0.6,
    h: inchOf(card.valueHPt),
    fontFace: type.pptxFamily,
    fontSize: type.valuePt,
    color: palette.value,
    bold: true,
    align: 'left',
    valign: 'middle',
    margin: 0,
  });

  // The triangle is a text glyph, so it stays vector and recolours with the run.
  slide.addText(`${deltaArrow(stats)} ${formatDelta(stats)}`, {
    x: place.xIn + padIn + innerIn * 0.6,
    y: place.yIn + inchOf(card.valueYPt),
    w: innerIn * 0.4,
    h: inchOf(card.valueHPt),
    fontFace: type.pptxFamily,
    fontSize: type.deltaPt,
    color: deltaColorFor(stats.sentiment),
    bold: true,
    align: 'right',
    valign: 'middle',
    margin: 0,
  });

  addLegend(pptx, slide, spec, place);
}

/** Two key swatches drawn as native line shapes, matching the chart's strokes. */
function addLegend(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: MetricCardSpec,
  place: CardPlacement,
): void {
  const padIn = inchOf(card.paddingPt);
  const y = place.yIn + inchOf(card.legendYPt + card.legendHPt / 2);
  const swatchW = inchOf(12);
  const gap = inchOf(4);
  const textW = inchOf(46);

  const keys = [
    { label: legend.actual, color: palette.line, width: 1.75, dash: undefined },
    { label: legend.average, color: palette.average, width: 1, dash: 'dash' as const },
  ];

  let x = place.xIn + padIn;
  for (const key of keys) {
    slide.addShape(pptx.ShapeType.line, {
      x,
      y,
      w: swatchW,
      h: 0,
      line: { color: key.color, width: key.width, dashType: key.dash },
    });
    slide.addText(key.label, {
      x: x + swatchW + gap,
      y: place.yIn + inchOf(card.legendYPt),
      w: textW,
      h: inchOf(card.legendHPt),
      fontFace: type.pptxFamily,
      fontSize: type.legendPt,
      color: palette.label,
      align: 'left',
      valign: 'middle',
      margin: 0,
    });
    x += swatchW + gap + textW + inchOf(8);
  }

  // Timeframe sits opposite the legend keys, out of the label's way.
  slide.addText(timeframeLabel(spec.series), {
    x: place.xIn + inchOf(card.widthPt) - inchOf(card.paddingPt) - inchOf(96),
    y: place.yIn + inchOf(card.legendYPt),
    w: inchOf(96),
    h: inchOf(card.legendHPt),
    fontFace: type.pptxFamily,
    fontSize: type.timeframePt,
    color: palette.timeframe,
    align: 'right',
    valign: 'middle',
    margin: 0,
  });
}

/**
 * The sparkline as a real chart part: area fill, dashed 12-month average, and the
 * trend line. Every default that would make this read as a chart rather than a
 * sparkline is switched off.
 */
export function addNativeSparkline(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: MetricCardSpec,
  place: CardPlacement,
): void {
  const stats = computeStats(spec);
  const values = spec.series.map((p) => p.value);
  const labels = spec.series.map((p) => monthLabel(p.month));
  const { min, max } = plotDomain(values, stats.average);

  const opts: PptxGenJS.IChartOpts = {
    x: place.xIn + inchOf(card.paddingPt),
    y: place.yIn + inchOf(card.sparkYPt),
    w: inchOf(innerWidthPt),
    h: inchOf(card.sparkHPt),
    showLegend: false,
    showTitle: false,
    showValue: false,
    catAxisHidden: true,
    valAxisHidden: true,
    catGridLine: { style: 'none' },
    valGridLine: { style: 'none' },
    valAxisMinVal: min,
    valAxisMaxVal: max,
    lineDataSymbol: 'none',
    lineSmooth: false,
    chartArea: { fill: { color: palette.cardBg }, border: { pt: 0, color: palette.cardBg } },
    plotArea: { fill: { color: palette.cardBg }, border: { pt: 0, color: palette.cardBg } },
    layout: { x: 0, y: 0, w: 1, h: 1 },
  };

  addMultiChart(
    slide,
    [
      {
        type: pptx.ChartType.area,
        data: [{ name: 'Trend fill', labels, values }],
        options: { chartColors: [palette.lineArea], barGrouping: 'standard' },
      },
      {
        type: pptx.ChartType.line,
        data: [{ name: legend.average, labels, values: values.map(() => stats.average) }],
        options: { chartColors: [palette.average], lineSize: 1, lineDash: 'dash', lineDataSymbol: 'none' },
      },
      {
        type: pptx.ChartType.line,
        data: [{ name: legend.actual, labels, values }],
        options: { chartColors: [palette.line], lineSize: 2, lineDataSymbol: 'none' },
      },
    ],
    opts,
  );
}

/**
 * The sparkline as a picture — the library's own pixels or its own SVG.
 *
 * An SVG data URI is stored the way PowerPoint stores vector art: a PNG fallback
 * blip carrying an `asvg:svgBlip` extension, so modern PowerPoint draws the
 * vector and older versions still show something. PptxGenJS handles that split.
 */
export function addImageSparkline(
  slide: PptxGenJS.Slide,
  spec: MetricCardSpec,
  place: CardPlacement,
  dataUri: string,
): void {
  const stats = computeStats(spec);
  slide.addImage({
    data: dataUri,
    x: place.xIn + inchOf(card.paddingPt),
    y: place.yIn + inchOf(card.sparkYPt),
    w: inchOf(innerWidthPt),
    h: inchOf(card.sparkHPt),
    altText:
      `${spec.label}: 12-month trend, ${timeframeLabel(spec.series)}. ` +
      `Latest ${formatValue(stats.current, spec.format)}, period average ` +
      `${formatValue(stats.average, spec.format)}.`,
  });
}

/** Draws one complete card, filling the sparkline slot per the chosen strategy. */
export function addMetricCard(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: MetricCardSpec,
  place: CardPlacement,
  fill: SparklineFill,
): void {
  addCardChrome(pptx, slide, spec, place);
  if (fill.kind === 'native') addNativeSparkline(pptx, slide, spec, place);
  else addImageSparkline(slide, spec, place, fill.dataUri);
}
