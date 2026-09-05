import { Suspense, useState } from 'react';
import { CARDS } from './core/data';
import type { ExportStrategy } from './core/types';
import { captureFor } from './pptx/capture';
import { downloadMetricDeck, type ExportTimings } from './pptx/export';
import { DEFAULT_RENDERER_ID, RENDERERS, findRenderer } from './renderers';
import { ComparisonTable } from './ui/ComparisonTable';
import { MetricCard } from './ui/MetricCard';

const STRATEGY_COPY: Record<ExportStrategy, { name: string; blurb: string }> = {
  native: {
    name: 'Native chart',
    blurb: 'Rebuilt as a real OOXML chart part — editable in PowerPoint, vector, with a working data sheet.',
  },
  vector: {
    name: 'Vector image',
    blurb: "The library's own SVG embedded as a picture. Pixel-identical to this page, sharp at any zoom, not editable.",
  },
  raster: {
    name: 'Raster image',
    blurb: 'A 3× PNG of the rendered chart. The only option for canvas libraries; blurs when zoomed.',
  },
};

export function App() {
  const [rendererId, setRendererId] = useState(DEFAULT_RENDERER_ID);
  const [strategy, setStrategy] = useState<ExportStrategy>('native');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ timings: ExportTimings; slides: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const renderer = findRenderer(rendererId);
  const available = renderer.supports.includes(strategy);

  const onExport = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await downloadMetricDeck(
        {
          cards: CARDS,
          strategy,
          capture: strategy === 'native' ? undefined : captureFor(strategy),
          title: `Metric cards — ${renderer.name}`,
          subtitle: `${STRATEGY_COPY[strategy].name} export · trailing 12 months`,
        },
        `metric-cards-${renderer.id}-${strategy}.pptx`,
      );
      setLast({ timings: result.timings, slides: result.slides });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      <header className="hero">
        <h1>Chart cards</h1>
        <p>
          Ten metric cards — current value, month-over-month delta, 12-month sparkline against its
          average — drawn by seven chart libraries and exported to PowerPoint three different ways.
        </p>
      </header>

      <section className="controls">
        <div className="ctrl">
          <span className="ctrl__label">Library</span>
          <div className="switcher" role="tablist" aria-label="Chart library">
            {RENDERERS.map((r) => (
              <button
                key={r.id}
                role="tab"
                aria-selected={r.id === rendererId}
                className={r.id === rendererId ? 'is-active' : undefined}
                onClick={() => setRendererId(r.id)}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        <div className="ctrl">
          <span className="ctrl__label">Export strategy</span>
          <div className="switcher" role="tablist" aria-label="Export strategy">
            {(Object.keys(STRATEGY_COPY) as ExportStrategy[]).map((s) => {
              const supported = renderer.supports.includes(s);
              return (
                <button
                  key={s}
                  role="tab"
                  aria-selected={s === strategy}
                  disabled={!supported}
                  title={supported ? undefined : `${renderer.name} renders to canvas — no SVG to embed.`}
                  className={s === strategy ? 'is-active' : undefined}
                  onClick={() => setStrategy(s)}
                >
                  {STRATEGY_COPY[s].name}
                </button>
              );
            })}
          </div>
        </div>

        <button className="export" onClick={onExport} disabled={busy || !available}>
          {busy ? 'Building deck…' : 'Export to PowerPoint'}
        </button>
      </section>

      <p className="active-note">
        <strong>{renderer.name}</strong> · ~{renderer.bundleKb} KB gzipped · {renderer.tech}
        {' — '}
        {STRATEGY_COPY[strategy].blurb}
      </p>

      {!available && (
        <p className="warn">
          {renderer.name} renders to canvas, so there is no SVG to embed. Use <em>Native chart</em> or{' '}
          <em>Raster image</em>.
        </p>
      )}

      {error && <p className="warn">Export failed: {error}</p>}

      {last && (
        <dl className="timings">
          <div><dt>Capture</dt><dd>{last.timings.captureMs.toFixed(0)} ms</dd></div>
          <div><dt>Compose</dt><dd>{last.timings.composeMs.toFixed(0)} ms</dd></div>
          <div><dt>Serialize</dt><dd>{last.timings.serializeMs.toFixed(0)} ms</dd></div>
          <div className="timings__total"><dt>Total</dt><dd>{last.timings.totalMs.toFixed(0)} ms</dd></div>
          <div><dt>Slides</dt><dd>{last.slides}</dd></div>
        </dl>
      )}

      <Suspense fallback={<section className="grid grid--loading">Loading {renderer.name}…</section>}>
        <section className="grid">
          {CARDS.map((spec) => (
            <MetricCard key={spec.id} spec={spec} renderer={renderer} />
          ))}
        </section>
      </Suspense>

      <section className="prose">
        <h2>How the libraries compare</h2>
        <p>
          Switching library changes only the sparkline. The frame, value, delta and legend are the
          same DOM every time — and the same native PowerPoint objects on export — because those
          are the parts PowerPoint reproduces exactly. Click a row to preview that library.
        </p>
      </section>

      <ComparisonTable activeId={rendererId} onSelect={setRendererId} />

      <footer>
        Design tokens live in points, not pixels, because PPTX is a point-based format and the
        browser is the side that adapts. Run <code>npm run bench:export</code> for the full
        library × strategy timing matrix.
      </footer>
    </main>
  );
}
