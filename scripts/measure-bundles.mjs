/**
 * Measures what each chart library actually costs in this repo.
 *
 * Each renderer is bundled standalone with React and the shared core marked
 * external, so the number is the library plus its own dependencies and nothing
 * else. Reported gzipped, which is what a browser downloads.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const RENDERERS = [
  ['svg', 'SvgSparkline'],
  ['uplot', 'UplotSparkline'],
  ['echarts', 'EchartsSparkline'],
  ['recharts', 'RechartsSparkline'],
  ['visx', 'VisxSparkline'],
  ['plot', 'PlotSparkline'],
  ['chartjs', 'ChartjsSparkline'],
];

const results = [];
for (const [id, file] of RENDERERS) {
  const out = `dist-verify/size-${id}.js`;
  execFileSync(
    './node_modules/.bin/esbuild',
    [
      `src/renderers/${file}.tsx`,
      '--bundle',
      '--minify',
      '--format=esm',
      '--platform=browser',
      '--loader:.css=css',
      '--external:react',
      '--external:react-dom',
      '--external:react/jsx-runtime',
      `--outfile=${out}`,
      '--log-level=error',
    ],
    { stdio: 'inherit' },
  );
  const raw = readFileSync(out);
  results.push({ id, min: raw.byteLength, gzip: gzipSync(raw).byteLength });
  rmSync(out, { force: true });
}

results.sort((a, b) => a.gzip - b.gzip);
const kb = (n) => (n / 1024).toFixed(1);
console.log('\n  library      minified    gzipped');
for (const r of results) {
  console.log(`  ${r.id.padEnd(11)} ${(kb(r.min) + ' KB').padStart(9)}  ${(kb(r.gzip) + ' KB').padStart(9)}`);
}
console.log('\n  React and the shared core are excluded — this is the library cost only.\n');
console.log(JSON.stringify(Object.fromEntries(results.map((r) => [r.id, Math.round(r.gzip / 1024)]))));
