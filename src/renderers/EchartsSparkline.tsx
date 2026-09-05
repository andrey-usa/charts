import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { plotDomain, web } from '../core/tokens';
import type { SparklineProps } from '../core/types';

/**
 * Apache ECharts v6 in SVG mode. The heavyweight of the set, but the SVG renderer
 * is what makes it exportable as vector rather than pixels.
 */
export function EchartsSparkline({
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
    const chart = echarts.init(host.current, undefined, { renderer: 'svg', width, height });

    chart.setOption({
      animation: false,
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { type: 'category', show: false, boundaryGap: false, data: values.map((_, i) => i) },
      yAxis: { type: 'value', show: false, min, max },
      series: [
        {
          type: 'line',
          data: values as number[],
          showSymbol: false,
          lineStyle: { color: web(lineColor), width: 1.75 },
          areaStyle: { color: web(areaColor) },
        },
        {
          type: 'line',
          data: values.map(() => average),
          showSymbol: false,
          lineStyle: { color: web(averageColor), width: 1, type: [3, 3] },
        },
      ],
    });

    return () => chart.dispose();
  }, [values, average, width, height, lineColor, averageColor, areaColor]);

  return <div ref={host} style={{ width, height }} />;
}

export default EchartsSparkline;
