import { useEffect, useRef } from 'react';
import {
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  CategoryScale,
} from 'chart.js';
import { plotDomain, web } from '../core/tokens';
import type { SparklineProps } from '../core/types';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler);

/**
 * Chart.js — canvas, ubiquitous, and the clearest illustration of the export
 * problem: whatever it draws is pixels, so a deck can only ever hold a screenshot.
 */
export function ChartjsSparkline({
  values,
  average,
  width,
  height,
  lineColor,
  averageColor,
  areaColor,
}: SparklineProps) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const { min, max } = plotDomain(values, average);

    const chart = new Chart(canvas.current, {
      type: 'line',
      data: {
        labels: values.map((_, i) => String(i)),
        datasets: [
          {
            data: values as number[],
            borderColor: web(lineColor),
            borderWidth: 1.75,
            backgroundColor: web(areaColor),
            fill: true,
            pointRadius: 0,
            tension: 0,
          },
          {
            data: values.map(() => average),
            borderColor: web(averageColor),
            borderWidth: 1,
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: false,
        animation: false,
        layout: { padding: 0 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false, min, max } },
      },
    });

    return () => chart.destroy();
  }, [values, average, width, height, lineColor, averageColor, areaColor]);

  return <canvas ref={canvas} width={width} height={height} style={{ width, height }} />;
}

export default ChartjsSparkline;
