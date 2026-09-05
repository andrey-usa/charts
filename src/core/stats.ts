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
      return `${value.toFixed(0)}ms`;
    case 'number':
      return value >= 1000
        ? `${(value / 1000).toFixed(1)}k`
        : value.toFixed(value % 1 === 0 ? 0 : 1);
  }
}

/** e.g. "▲ 4.2%" — the arrow is a text glyph so it stays vector in PPTX. */
export function formatDelta(stats: MetricStats): string {
  const arrow = stats.direction === 'up' ? '▲' : stats.direction === 'down' ? '▼' : '■';
  return `${arrow} ${Math.abs(stats.deltaPct).toFixed(1)}%`;
}

export function monthLabel(month: string): string {
  const [, m] = month.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[Number(m) - 1] ?? month;
}
