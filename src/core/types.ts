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

/**
 * How the sparkline reaches the slide. Defined here rather than in the PPTX
 * layer so the renderer registry can declare what each library supports without
 * importing the exporter.
 */
export type ExportStrategy = 'native' | 'vector' | 'raster';

export interface RendererEntry {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly tech: 'SVG' | 'Canvas' | 'SVG (React)' | 'Canvas (WebGL-capable)';
  readonly bundleKb: number;
  /** The best fidelity this library's own output can reach in a deck. */
  readonly pptxFidelity: 'native' | 'vector-image' | 'raster';
  /**
   * Export strategies this library can actually serve. `native` is always
   * available because it rebuilds from the data; `vector` needs SVG output.
   */
  readonly supports: readonly ExportStrategy[];
  readonly note: string;
  /** Lazily imported so switching libraries loads only that library's chunk. */
  readonly Component: LazyExoticComponent<ComponentType<SparklineProps>>;
}
