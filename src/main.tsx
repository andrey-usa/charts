import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { CARDS } from './core/data';
import { captureFor } from './pptx/capture';
import { exportMetricDeck } from './pptx/export';
import './styles.css';

/**
 * Benchmark hook. `scripts/bench-export.mjs` drives the real export path from a
 * real browser through this, so the measured numbers come from the same code the
 * Export button runs — not a Node-side reimplementation of it.
 */
declare global {
  interface Window {
    __chartsBench?: { CARDS: typeof CARDS; captureFor: typeof captureFor; exportMetricDeck: typeof exportMetricDeck };
  }
}
window.__chartsBench = { CARDS, captureFor, exportMetricDeck };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
