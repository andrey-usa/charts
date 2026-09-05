import { lazy } from 'react';
import type { RendererEntry } from '../core/types';

/**
 * Each renderer is code-split, so loading the page costs only the baseline SVG
 * chunk and picking a library in the UI pulls that library and nothing else.
 *
 * `bundleKb` is measured, not estimated: `npm run measure:bundles` bundles each
 * renderer standalone with React excluded and reports the gzipped result.
 */
export const RENDERERS: readonly RendererEntry[] = [
  {
    id: 'svg',
    supports: ['native', 'vector', 'raster'],
    name: 'Hand-rolled SVG',
    version: 'd3-shape 3.2',
    tech: 'SVG',
    bundleKb: 2,
    pptxFidelity: 'native',
    note: 'Two paths and a line. Every primitive maps onto something OOXML has, so the PPTX export is a true native chart.',
    Component: lazy(() => import('./SvgSparkline')),
  },
  {
    id: 'uplot',
    supports: ['native', 'raster'],
    name: 'uPlot',
    version: '1.6',
    tech: 'Canvas',
    bundleKb: 23,
    pptxFidelity: 'raster',
    note: 'Fastest of the set and tiny for what it does, but canvas output can only leave the page as pixels.',
    Component: lazy(() => import('./UplotSparkline')),
  },
  {
    id: 'echarts',
    supports: ['native', 'vector', 'raster'],
    name: 'Apache ECharts',
    version: '6.1',
    tech: 'SVG',
    bundleKb: 373,
    pptxFidelity: 'vector-image',
    note: 'Enormous feature surface. In SVG mode the markup can be embedded as a vector image — sharp at any zoom, but not an editable chart object.',
    Component: lazy(() => import('./EchartsSparkline')),
  },
  {
    id: 'recharts',
    supports: ['native', 'vector', 'raster'],
    name: 'Recharts',
    version: '2.15',
    tech: 'SVG (React)',
    bundleKb: 107,
    pptxFidelity: 'vector-image',
    note: 'The React default. Composable and readable; most of the work is turning its opinions off.',
    Component: lazy(() => import('./RechartsSparkline')),
  },
  {
    id: 'visx',
    supports: ['native', 'vector', 'raster'],
    name: 'visx',
    version: '3.12',
    tech: 'SVG (React)',
    bundleKb: 15,
    pptxFidelity: 'vector-image',
    note: 'Airbnb’s d3-in-React primitives. No chart abstraction to fight, which is exactly why the code is longer.',
    Component: lazy(() => import('./VisxSparkline')),
  },
  {
    id: 'plot',
    supports: ['native', 'vector', 'raster'],
    name: 'Observable Plot',
    version: '0.6',
    tech: 'SVG',
    bundleKb: 93,
    pptxFidelity: 'vector-image',
    note: 'Grammar of graphics. The most expressive per line of code here — three marks and it is done.',
    Component: lazy(() => import('./PlotSparkline')),
  },
  {
    id: 'chartjs',
    supports: ['native', 'raster'],
    name: 'Chart.js',
    version: '4.5',
    tech: 'Canvas',
    bundleKb: 51,
    pptxFidelity: 'raster',
    note: 'Ubiquitous and easy. Canvas-only, so a slide can hold a screenshot of it and nothing better.',
    Component: lazy(() => import('./ChartjsSparkline')),
  },
];

export const DEFAULT_RENDERER_ID = 'svg';

export function findRenderer(id: string): RendererEntry {
  return RENDERERS.find((r) => r.id === id) ?? RENDERERS[0]!;
}
