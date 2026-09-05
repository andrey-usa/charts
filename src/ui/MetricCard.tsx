import { computeStats, formatDelta, formatValue } from '../core/stats';
import { card, palette, pxOf, type, web } from '../core/tokens';
import type { MetricCardSpec, RendererEntry } from '../core/types';

interface Props {
  readonly spec: MetricCardSpec;
  readonly renderer: RendererEntry;
}

/**
 * The web half of the card. Geometry comes from the same point-based tokens the
 * PPTX writer uses, so the two outputs line up instead of merely resembling
 * each other.
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

  return (
    <article
      className="metric-card"
      style={{
        width: pxOf(card.widthPt),
        height: pxOf(card.heightPt),
        padding: pxOf(card.paddingPt),
        borderRadius: pxOf(card.radiusPt),
        background: web(palette.cardBg),
        borderColor: web(palette.cardBorder),
        fontFamily: type.family,
      }}
    >
      <div
        className="metric-card__label"
        style={{ fontSize: pxOf(type.labelPt), color: web(palette.label) }}
      >
        {spec.label}
      </div>

      <div className="metric-card__row">
        <span style={{ fontSize: pxOf(type.valuePt), color: web(palette.value) }}>
          {formatValue(stats.current, spec.format)}
        </span>
        <span style={{ fontSize: pxOf(type.deltaPt), color: web(deltaColor) }}>
          {formatDelta(stats)}
        </span>
      </div>

      <div className="metric-card__spark">
        <Sparkline
          values={values}
          average={stats.average}
          width={pxOf(card.widthPt - card.paddingPt * 2)}
          height={pxOf(card.sparkHeightPt)}
          lineColor={palette.line}
          averageColor={palette.average}
          areaColor={palette.lineArea}
        />
      </div>
    </article>
  );
}
