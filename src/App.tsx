import { Suspense, useState } from 'react';
import { CARDS } from './core/data';
import { downloadDeck } from './pptx/deck';
import { DEFAULT_RENDERER_ID, RENDERERS, findRenderer } from './renderers';
import { ComparisonTable } from './ui/ComparisonTable';
import { MetricCard } from './ui/MetricCard';

export function App() {
  const [rendererId, setRendererId] = useState(DEFAULT_RENDERER_ID);
  const [exporting, setExporting] = useState(false);
  const renderer = findRenderer(rendererId);

  const onExport = async (): Promise<void> => {
    setExporting(true);
    try {
      await downloadDeck(CARDS, 'metric-cards.pptx', {
        title: 'Metric cards — native PPTX export',
        subtitle: 'Trailing 12 months · dashed line is the period average',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <main>
      <header className="hero">
        <h1>Chart cards</h1>
        <p>
          One metric-card spec, drawn by seven different chart libraries — then exported to
          PowerPoint as native shapes, text and chart parts. Nothing in the deck is a screenshot.
        </p>
      </header>

      <section className="controls">
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

        <button className="export" onClick={onExport} disabled={exporting}>
          {exporting ? 'Building deck…' : 'Export to PowerPoint'}
        </button>
      </section>

      <p className="active-note">
        <strong>{renderer.name}</strong> · ~{renderer.bundleKb} KB gzipped · {renderer.tech} — {renderer.note}
      </p>

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
          Switching renderers above changes only the sparkline. The card frame, the value and the
          delta are plain DOM in every case, because those are the parts PowerPoint can reproduce
          exactly. Click a row to preview that library.
        </p>
      </section>

      <ComparisonTable activeId={rendererId} onSelect={setRendererId} />

      <section className="prose">
        <h2>Why the export is a rewrite, not a screenshot</h2>
        <p>
          No web charting library emits PowerPoint. Their export pipelines all end at PNG, SVG or
          PDF, so anything they hand you lands in a deck as a picture. The way to get a real chart
          is to render the same spec a second time with a PPTX writer — here, PptxGenJS composing a
          rounded rectangle, three text boxes and one chart part per card.
        </p>
        <p>
          That is what <code>npm run verify:pptx</code> checks: it opens the generated file as a zip
          and asserts there is one <code>ppt/charts/chart*.xml</code> per card, an embedded workbook
          behind each one, and nothing at all in <code>ppt/media</code>.
        </p>
      </section>

      <footer>
        Design tokens live in points, not pixels, because PPTX is a point-based format and the
        browser is the side that adapts.
      </footer>
    </main>
  );
}
