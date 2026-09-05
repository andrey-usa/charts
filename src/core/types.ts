import type { ComponentType, LazyExoticComponent } from 'react';

/** One month of history for a metric. */
export interface MonthPoint {
  /** ISO year-month, e.g. "2026-03". */
  readonly month: string;
  readonly value: number;
}

export type ValueFormat = 'number' | 'currency' | 'percent' | 'duration';

/**
 * The single source of truth for a metric card.
 *
 * Both the web renderers and the PPTX writer consume this exact shape, which is
 * what makes on-screen output and exported slides agree.
 */
export interface MetricCardSpec {
  readonly id: string;
  readonly label: string;
  readonly format: ValueFormat;
  /** Exactly 12 points, oldest first. */
  readonly series: readonly MonthPoint[];
  /** When true, a falling value is the good outcome (e.g. churn, latency). */
  readonly lowerIsBetter?: boolean;
}

/** Everything derived from a spec that both renderers need. */
export interface MetricStats {
  readonly current: number;
  readonly previous: number;
  readonly average: number;
  readonly min: number;
  readonly max: number;
  readonly deltaAbs: number;
  readonly deltaPct: number;
  readonly direction: 'up' | 'down' | 'flat';
  /** Direction interpreted against `lowerIsBetter`. */
  readonly sentiment: 'positive' | 'negative' | 'neutral';
}

/** Props every renderer in `src/renderers/` implements identically. */
export interface SparklineProps {
  readonly values: readonly number[];
  readonly average: number;
  /** Plot box in CSS pixels. */
  readonly width: number;
  readonly height: number;
  readonly lineColor: string;
  readonly averageColor: string;
  readonly areaColor: string;
}

export interface RendererEntry {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly tech: 'SVG' | 'Canvas' | 'SVG (React)' | 'Canvas (WebGL-capable)';
  readonly bundleKb: number;
  /** How the library's output survives a PowerPoint export. */
  readonly pptxFidelity: 'native' | 'vector-image' | 'raster';
  readonly note: string;
  /** Lazily imported so switching libraries loads only that library's chunk. */
  readonly Component: LazyExoticComponent<ComponentType<SparklineProps>>;
}
