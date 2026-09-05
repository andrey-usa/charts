import { useEffect, useRef } from 'react';
import * as Plot from '@observablehq/plot';
import { plotDomain, web } from '../core/tokens';
import type { SparklineProps } from '../core/types';

/**
 * Observable Plot — grammar of graphics, the modern successor to writing raw d3.
 * Terse to the point of showing off, and it emits SVG.
 */
export function PlotSparkline({
  values,
  average,
  width,
  height,
  lineColor,
  averageColor,
  areaColor,
}: SparklineProps) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const { min, max } = plotDomain(values, average);
    const data = values.map((value, i) => ({ i, value }));

    const chart = Plot.plot({
      width,
      height,
      margin: 0,
      x: { axis: null, domain: [0, values.length - 1] },
      y: { axis: null, domain: [min, max] },
      marks: [
        Plot.areaY(data, { x: 'i', y: 'value', fill: web(areaColor) }),
        Plot.ruleY([average], { stroke: web(averageColor), strokeDasharray: '3 3', strokeWidth: 1 }),
        Plot.lineY(data, { x: 'i', y: 'value', stroke: web(lineColor), strokeWidth: 1.75 }),
      ],
    });

    host.current.append(chart);
    return () => chart.remove();
  }, [values, average, width, height, lineColor, averageColor, areaColor]);

  return <div ref={host} style={{ width, height }} />;
}

export default PlotSparkline;
