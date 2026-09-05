import { Area, ComposedChart, Line, ReferenceLine, YAxis } from 'recharts';
import { plotDomain, web } from '../core/tokens';
import type { SparklineProps } from '../core/types';

/**
 * Recharts — the default choice in most React codebases. Declarative and pleasant,
 * but note how much has to be switched off to get down to a sparkline.
 *
 * ComposedChart rather than AreaChart: `<Line>` is only honoured as a child of a
 * composed chart, and inside `<AreaChart>` it silently renders nothing.
 */
export function RechartsSparkline({
  values,
  average,
  width,
  height,
  lineColor,
  averageColor,
  areaColor,
}: SparklineProps) {
  const { min, max } = plotDomain(values, average);
  const data = values.map((value, i) => ({ i, value }));

  return (
    <ComposedChart width={width} height={height} data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
      <YAxis hide domain={[min, max]} />
      <Area
        type="linear"
        dataKey="value"
        stroke="none"
        fill={web(areaColor)}
        isAnimationActive={false}
      />
      <ReferenceLine y={average} stroke={web(averageColor)} strokeDasharray="3 3" strokeWidth={1} />
      <Line
        type="linear"
        dataKey="value"
        stroke={web(lineColor)}
        strokeWidth={1.75}
        dot={false}
        isAnimationActive={false}
      />
    </ComposedChart>
  );
}

export default RechartsSparkline;
