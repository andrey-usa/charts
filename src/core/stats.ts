import type { MetricCardSpec, MetricStats, ValueFormat } from './types';

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

export function computeStats(spec: MetricCardSpec): MetricStats {
  const values = spec.series.map((p) => p.value);
  const current = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? current;
  const average = mean(values);
  const deltaAbs = current - previous;
  const deltaPct = previous === 0 ? 0 : (deltaAbs / Math.abs(previous)) * 100;

  const direction: MetricStats['direction'] =
    Math.abs(deltaPct) < 0.05 ? 'flat' : deltaAbs > 0 ? 'up' : 'down';

  let sentiment: MetricStats['sentiment'] = 'neutral';
  if (direction !== 'flat') {
    const good = spec.lowerIsBetter ? direction === 'down' : direction === 'up';
    sentiment = good ? 'positive' : 'negative';
  }

  return {
    current,
    previous,
    average,
    min: Math.min(...values),
    max: Math.max(...values),
    deltaAbs,
    deltaPct,
    direction,
    sentiment,
  };
}

export function formatValue(value: number, format: ValueFormat): string {
  switch (format) {
    case 'currency':
      return value >= 1000
        ? `$${(value / 1000).toFixed(1)}k`
        : `$${value.toFixed(0)}`;
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'duration':
      // Step the unit so a 4-second response time doesn't read as "4089ms".
      if (value < 1000) return `${value.toFixed(0)}ms`;
      if (value < 60_000) return `${(value / 1000).toFixed(1)}s`;
      return `${(value / 60_000).toFixed(1)}min`;
    case 'number':
      return value >= 1000
        ? `${(value / 1000).toFixed(1)}k`
        : value.toFixed(value % 1 === 0 ? 0 : 1);
  }
}

/**
 * The delta magnitude alone, e.g. "4.2%".
 *
 * The direction triangle is deliberately NOT included: both renderers draw it
 * themselves so it can be a separate glyph, and having it here too silently
 * produced "▲▲ 4.2%" on every card.
 */
export function formatDelta(stats: MetricStats): string {
  return `${Math.abs(stats.deltaPct).toFixed(1)}%`;
}

/** The direction triangle. A text glyph, so it stays vector in PPTX. */
export function deltaArrow(stats: MetricStats): string {
  return stats.direction === 'up' ? '▲' : stats.direction === 'down' ? '▼' : '■';
}

export function monthLabel(month: string): string {
  const [, m] = month.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[Number(m) - 1] ?? month;
}

/** e.g. "Oct 2025 – Sep 2026", for the card's timeframe caption. */
export function timeframeLabel(series: readonly { month: string }[]): string {
  const first = series[0]?.month;
  const last = series[series.length - 1]?.month;
  if (!first || !last) return '';
  const fmt = (m: string): string => {
    const [y, mm] = m.split('-');
    return `${monthLabel(`${y}-${mm}`)} ${y}`;
  };
  return `${fmt(first)} – ${fmt(last)}`;
}
