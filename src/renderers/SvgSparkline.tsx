import { area, line } from 'd3-shape';
import { plotDomain, web } from '../core/tokens';
import type { SparklineProps } from '../core/types';

/**
 * Baseline renderer: no charting library at all, just two `<path>` elements.
 *
 * This is the reference the PPTX export is matched against — every shape it
 * draws maps 1:1 onto something OOXML can express natively.
 */
export function SvgSparkline({
  values,
  average,
  width,
  height,
  lineColor,
  averageColor,
  areaColor,
}: SparklineProps) {
  const { min, max } = plotDomain(values, average);
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => height - ((v - min) / (max - min)) * height;

  const linePath = line<number>()
    .x((_, i) => x(i))
    .y((v) => y(v))(values as number[]);

  const areaPath = area<number>()
    .x((_, i) => x(i))
    .y0(height)
    .y1((v) => y(v))(values as number[]);

  const avgY = y(average);

  return (
    <svg width={width} height={height} role="img" aria-label="12-month trend">
      {areaPath && <path d={areaPath} fill={web(areaColor)} />}
      <line
        x1={0}
        x2={width}
        y1={avgY}
        y2={avgY}
        stroke={web(averageColor)}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      {linePath && (
        <path d={linePath} fill="none" stroke={web(lineColor)} strokeWidth={1.75} strokeLinejoin="round" />
      )}
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1] ?? 0)} r={2.5} fill={web(lineColor)} />
    </svg>
  );
}

export default SvgSparkline;
