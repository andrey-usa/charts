import { Group } from '@visx/group';
import { scaleLinear } from '@visx/scale';
import { AreaClosed, Line, LinePath } from '@visx/shape';
import { plotDomain, web } from '../core/tokens';
import type { SparklineProps } from '../core/types';

/**
 * visx (Airbnb) — d3 maths with React rendering the SVG. No chart abstraction at
 * all, so it needs the most code but leaves nothing to fight against.
 */
export function VisxSparkline({
  values,
  average,
  width,
  height,
  lineColor,
  averageColor,
  areaColor,
}: SparklineProps) {
  const { min, max } = plotDomain(values, average);
  const xScale = scaleLinear<number>({ domain: [0, values.length - 1], range: [0, width] });
  const yScale = scaleLinear<number>({ domain: [min, max], range: [height, 0] });

  const points = values.map((value, i) => ({ i, value }));
  const getX = (d: { i: number }) => xScale(d.i);
  const getY = (d: { value: number }) => yScale(d.value);
  const avgY = yScale(average);

  return (
    <svg width={width} height={height}>
      <Group>
        <AreaClosed
          data={points}
          x={getX}
          y={getY}
          yScale={yScale}
          fill={web(areaColor)}
          stroke="none"
        />
        <Line
          from={{ x: 0, y: avgY }}
          to={{ x: width, y: avgY }}
          stroke={web(averageColor)}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <LinePath data={points} x={getX} y={getY} stroke={web(lineColor)} strokeWidth={1.75} />
      </Group>
    </svg>
  );
}

export default VisxSparkline;
