import { computeStats, deltaArrow, formatDelta, formatValue, timeframeLabel } from '../core/stats';
import { card, innerWidthPt, legend, palette, pxOf, type, web } from '../core/tokens';
import type { MetricCardSpec, RendererEntry } from '../core/types';

interface Props {
  readonly spec: MetricCardSpec;
  readonly renderer: RendererEntry;
}

/**
 * The web half of the card. Row offsets come from the same point-based tokens the
 * PPTX writer uses, so the two outputs line up instead of merely resembling each
 * other — absolute positioning here mirrors PowerPoint's absolute placement.
 */
export function MetricCard({ spec, renderer }: Props) {
  const stats = computeStats(spec);
  const values = spec.series.map((p) => p.value);
  const Sparkline = renderer.Component;

  const deltaColor =
    stats.sentiment === 'positive'
      ? palette.positive
      : stats.sentiment === 'negative'
        ? palette.negative
        : palette.neutral;

  const sentimentWord =
    stats.sentiment === 'positive' ? 'better' : stats.sentiment === 'negative' ? 'worse' : 'flat';

  return (
    <article
      className="mc"
      data-card-id={spec.id}
      style={{
        width: pxOf(card.widthPt),
        height: pxOf(card.heightPt),
        borderRadius: pxOf(card.radiusPt),
        background: web(palette.cardBg),
        borderColor: web(palette.cardBorder),
        fontFamily: type.family,
      }}
    >
      <div
        className="mc__row mc__label-row"
        style={{ top: pxOf(card.labelYPt), height: pxOf(card.labelHPt) }}
      >
        <span style={{ fontSize: pxOf(type.labelPt), color: web(palette.label) }}>{spec.label}</span>
      </div>

      <div className="mc__row" style={{ top: pxOf(card.valueYPt), height: pxOf(card.valueHPt) }}>
        <span className="mc__value" style={{ fontSize: pxOf(type.valuePt), color: web(palette.value) }}>
          {formatValue(stats.current, spec.format)}
        </span>
        <span
          className="mc__delta"
          style={{ fontSize: pxOf(type.deltaPt), color: web(deltaColor) }}
          title={`${formatValue(Math.abs(stats.deltaAbs), spec.format)} vs. previous month — ${sentimentWord}`}
        >
          <span aria-hidden="true">{deltaArrow(stats)}</span> {formatDelta(stats)}
          <span className="sr-only">
            {` ${stats.direction} versus previous month, ${sentimentWord}`}
          </span>
        </span>
      </div>

      <div className="mc__spark" style={{ top: pxOf(card.sparkYPt) }}>
        <Sparkline
          values={values}
          average={stats.average}
          width={pxOf(innerWidthPt)}
          height={pxOf(card.sparkHPt)}
          lineColor={palette.line}
          averageColor={palette.average}
          areaColor={palette.lineArea}
        />
      </div>

      <div
        className="mc__row mc__legend"
        style={{
          top: pxOf(card.legendYPt),
          height: pxOf(card.legendHPt),
          fontSize: pxOf(type.legendPt),
          color: web(palette.label),
        }}
      >
        <span className="mc__key">
          <i className="mc__swatch mc__swatch--solid" style={{ background: web(palette.line) }} />
          {legend.actual}
        </span>
        <span className="mc__key">
          <i className="mc__swatch mc__swatch--dashed" style={{ borderTopColor: web(palette.average) }} />
          {legend.average}
        </span>
        <span
          className="mc__timeframe"
          style={{ fontSize: pxOf(type.timeframePt), color: web(palette.timeframe) }}
        >
          {timeframeLabel(spec.series)}
        </span>
      </div>
    </article>
  );
}
