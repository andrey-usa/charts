import type { MetricCardSpec, MonthPoint } from './types';

/** Mulberry32 — deterministic so the demo (and its exports) reproduce exactly. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lastTwelveMonths(endYear: number, endMonth: number): string[] {
  const out: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(endYear, endMonth - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

interface SeriesShape {
  readonly start: number;
  readonly drift: number;
  readonly noise: number;
  readonly seed: number;
}

function buildSeries(months: readonly string[], shape: SeriesShape): MonthPoint[] {
  const rand = rng(shape.seed);
  let v = shape.start;
  return months.map((month, i) => {
    v = v * (1 + shape.drift) + (rand() - 0.5) * shape.noise * shape.start;
    // A gentle seasonal wave keeps the sparklines from looking like pure noise.
    const seasonal = 1 + Math.sin((i / 12) * Math.PI * 2) * 0.04;
    return { month, value: Math.max(0, v * seasonal) };
  });
}

const MONTHS = lastTwelveMonths(2026, 9);

export const CARDS: readonly MetricCardSpec[] = [
  {
    id: 'mrr',
    label: 'Monthly recurring revenue',
    format: 'currency',
    series: buildSeries(MONTHS, { start: 42000, drift: 0.035, noise: 0.05, seed: 11 }),
  },
  {
    id: 'active-users',
    label: 'Weekly active users',
    format: 'number',
    series: buildSeries(MONTHS, { start: 18400, drift: 0.028, noise: 0.07, seed: 23 }),
  },
  {
    id: 'churn',
    label: 'Net revenue churn',
    format: 'percent',
    lowerIsBetter: true,
    series: buildSeries(MONTHS, { start: 4.6, drift: -0.02, noise: 0.12, seed: 37 }),
  },
  {
    id: 'p95',
    label: 'API latency (p95)',
    format: 'duration',
    lowerIsBetter: true,
    series: buildSeries(MONTHS, { start: 320, drift: -0.015, noise: 0.1, seed: 41 }),
  },
  {
    id: 'nps',
    label: 'Net promoter score',
    format: 'number',
    series: buildSeries(MONTHS, { start: 38, drift: 0.012, noise: 0.09, seed: 53 }),
  },
  {
    id: 'cac',
    label: 'Customer acquisition cost',
    format: 'currency',
    lowerIsBetter: true,
    series: buildSeries(MONTHS, { start: 610, drift: -0.008, noise: 0.08, seed: 67 }),
  },
];
