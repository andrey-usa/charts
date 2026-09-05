import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { plotDomain, web } from '../core/tokens';
import type { SparklineProps } from '../core/types';

/**
 * uPlot — 45 KB, canvas, built for very large series. Chartjunk is opt-in rather
 * than opt-out, which makes it the least fussy library here to reduce to a sparkline.
 */
export function UplotSparkline({
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
    const xs = values.map((_, i) => i);

    const chart = new uPlot(
      {
        width,
        height,
        padding: [0, 0, 0, 0],
        legend: { show: false },
        cursor: { show: false },
        scales: { x: { time: false }, y: { range: () => [min, max] } },
        axes: [{ show: false }, { show: false }],
        series: [
          {},
          {
            stroke: web(lineColor),
            width: 1.75,
            fill: web(areaColor),
            points: { show: false },
          },
          {
            stroke: web(averageColor),
            width: 1,
            dash: [3, 3],
            points: { show: false },
          },
        ],
      },
      [xs, values as number[], values.map(() => average)],
      host.current,
    );

    return () => chart.destroy();
  }, [values, average, width, height, lineColor, averageColor, areaColor]);

  return <div ref={host} style={{ width, height }} />;
}

export default UplotSparkline;
