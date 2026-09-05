import type PptxGenJS from 'pptxgenjs';
import { computeStats, formatDelta, formatValue, monthLabel } from '../core/stats';
import { card, inchOf, palette, plotDomain, type } from '../core/tokens';
import type { MetricCardSpec } from '../core/types';

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

export interface CardPlacement {
  /** Top-left corner of the card, in inches. */
  readonly xIn: number;
  readonly yIn: number;
}

/**
 * Draws one metric card onto a slide using only native PowerPoint objects:
 * a rounded rectangle, three text boxes, and a real chart part.
 *
 * Nothing here is an image, so the result stays vector at any zoom and the
 * sparkline keeps a working "Edit Data" sheet in PowerPoint.
 */
export function addMetricCard(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: MetricCardSpec,
  place: CardPlacement,
): void {
  const stats = computeStats(spec);
  const values = spec.series.map((p) => p.value);
  const labels = spec.series.map((p) => monthLabel(p.month));
  const { min, max } = plotDomain(values, stats.average);

  const wIn = inchOf(card.widthPt);
  const hIn = inchOf(card.heightPt);
  const padIn = inchOf(card.paddingPt);
  const innerW = wIn - padIn * 2;

  // 1 — card frame
  slide.addShape(pptx.ShapeType.roundRect, {
    x: place.xIn,
    y: place.yIn,
    w: wIn,
    h: hIn,
    fill: { color: palette.cardBg },
    line: { color: palette.cardBorder, width: 0.75 },
    rectRadius: inchOf(card.radiusPt),
    shadow: {
      type: 'outer',
      color: '9AA3B2',
      opacity: 0.18,
      blur: 6,
      offset: 1.5,
      angle: 90,
    },
  });

  // 2 — label
  slide.addText(spec.label.toUpperCase(), {
    x: place.xIn + padIn,
    y: place.yIn + padIn,
    w: innerW,
    h: inchOf(11),
    fontFace: type.pptxFamily,
    fontSize: type.labelPt,
    color: palette.label,
    charSpacing: 0.6,
    bold: false,
    align: 'left',
    valign: 'top',
    margin: 0,
  });

  // 3 — current value and delta, sharing one row
  const valueY = place.yIn + inchOf(card.paddingPt + 13);
  const valueH = inchOf(32);

  slide.addText(formatValue(stats.current, spec.format), {
    x: place.xIn + padIn,
    y: valueY,
    w: innerW * 0.62,
    h: valueH,
    fontFace: type.pptxFamily,
    fontSize: type.valuePt,
    color: palette.value,
    bold: true,
    align: 'left',
    valign: 'middle',
    margin: 0,
  });

  const deltaColor =
    stats.sentiment === 'positive'
      ? palette.positive
      : stats.sentiment === 'negative'
        ? palette.negative
        : palette.neutral;

  slide.addText(formatDelta(stats), {
    x: place.xIn + padIn + innerW * 0.62,
    y: valueY,
    w: innerW * 0.38,
    h: valueH,
    fontFace: type.pptxFamily,
    fontSize: type.deltaPt,
    color: deltaColor,
    bold: true,
    align: 'right',
    valign: 'middle',
    margin: 0,
  });

  // 4 — sparkline as a real chart part (area fill + dashed average + trend line)
  const chartY = place.yIn + hIn - padIn - inchOf(card.sparkHeightPt);
  const chartOpts: PptxGenJS.IChartOpts = {
    x: place.xIn + padIn,
    y: chartY,
    w: innerW,
    h: inchOf(card.sparkHeightPt),

    // Strip every default that would make this look like a chart rather than a sparkline.
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

    // Chart and plot area blend into the card, and the plot fills its whole box.
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
        data: [{ name: '12-month average', labels, values: values.map(() => stats.average) }],
        options: { chartColors: [palette.average], lineSize: 1, lineDash: 'dash', lineDataSymbol: 'none' },
      },
      {
        type: pptx.ChartType.line,
        data: [{ name: spec.label, labels, values }],
        options: { chartColors: [palette.line], lineSize: 2, lineDataSymbol: 'none' },
      },
    ],
    chartOpts,
  );
}
