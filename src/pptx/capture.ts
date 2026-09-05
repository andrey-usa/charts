import { card, innerWidthPt, pxOf } from '../core/tokens';
import type { MetricCardSpec } from '../core/types';
import type { CaptureFn, SparklineCapture } from './export';

/** Export at 3× so a rasterized sparkline still reads on a projector. */
const RASTER_SCALE = 3;

const sparkNodeFor = (spec: MetricCardSpec): Element => {
  const host = document.querySelector(`[data-card-id="${spec.id}"] .mc__spark`);
  if (!host) throw new Error(`No rendered sparkline on screen for card "${spec.id}".`);
  return host;
};

/**
 * Serializes a live <svg> into a standalone data URI.
 *
 * Libraries drop attributes a detached SVG needs — ECharts omits nothing but
 * carries `position: absolute`, others omit the xmlns — so the root is repaired
 * before serializing. The marks themselves are untouched.
 */
function svgToDataUri(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.removeAttribute('style');

  const w = pxOf(innerWidthPt);
  const h = pxOf(card.sparkHPt);
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${w} ${h}`);

  const xml = new XMLSerializer().serializeToString(clone);
  // btoa is Latin-1 only; encode first so non-ASCII in any label survives.
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(xml)));
  return `data:image/svg+xml;base64,${b64}`;
}

function canvasToDataUri(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

/** Rasterizes an SVG through an offscreen canvas, for the raster strategy. */
async function svgToPngDataUri(svg: SVGSVGElement): Promise<string> {
  const src = svgToDataUri(svg);
  const w = pxOf(innerWidthPt);
  const h = pxOf(card.sparkHPt);

  const img = new Image();
  img.width = w;
  img.height = h;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not rasterize the sparkline SVG.'));
    img.src = src;
  });

  const canvas = document.createElement('canvas');
  canvas.width = w * RASTER_SCALE;
  canvas.height = h * RASTER_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context available for rasterizing.');
  ctx.scale(RASTER_SCALE, RASTER_SCALE);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/png');
}

/** Captures each library's exact on-screen SVG. SVG renderers only. */
export const captureVector: CaptureFn = (spec): SparklineCapture => {
  const node = sparkNodeFor(spec);
  const svg = node.querySelector('svg');
  if (!svg) throw new Error(`Card "${spec.id}" renders to canvas — vector capture is not possible.`);
  return { kind: 'svg', dataUri: svgToDataUri(svg) };
};

/** Captures a PNG. Works for every renderer, canvas or SVG. */
export const captureRaster: CaptureFn = async (spec): Promise<SparklineCapture> => {
  const node = sparkNodeFor(spec);
  const canvas = node.querySelector('canvas');
  if (canvas) return { kind: 'png', dataUri: canvasToDataUri(canvas) };

  const svg = node.querySelector('svg');
  if (!svg) throw new Error(`Card "${spec.id}" rendered neither an <svg> nor a <canvas>.`);
  return { kind: 'png', dataUri: await svgToPngDataUri(svg) };
};

export const captureFor = (strategy: 'vector' | 'raster'): CaptureFn =>
  strategy === 'vector' ? captureVector : captureRaster;
