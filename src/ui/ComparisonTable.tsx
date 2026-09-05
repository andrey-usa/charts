import { RENDERERS } from '../renderers';
import type { RendererEntry } from '../core/types';

const FIDELITY_COPY: Record<RendererEntry['pptxFidelity'], { label: string; blurb: string }> = {
  native: {
    label: 'Native chart',
    blurb: 'Rebuilt as a real OOXML chart part. Editable, vector, data-linked.',
  },
  'vector-image': {
    label: 'Vector image',
    blurb: 'SVG can be embedded as a vector picture — sharp at any zoom, but not editable as a chart.',
  },
  raster: {
    label: 'Raster only',
    blurb: 'Canvas output leaves the page as pixels. Blurs on zoom, dead on arrival in a deck.',
  },
};

interface Props {
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
}

export function ComparisonTable({ activeId, onSelect }: Props) {
  return (
    <div className="table-wrap">
      <table className="cmp">
        <thead>
          <tr>
            <th>Library</th>
            <th>Renders as</th>
            <th className="num">Cost (gzip)</th>
            <th>PPTX fidelity</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {RENDERERS.map((r) => (
            <tr
              key={r.id}
              className={r.id === activeId ? 'is-active' : undefined}
              onClick={() => onSelect(r.id)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(r.id);
                }
              }}
            >
              <td>
                <strong>{r.name}</strong>
                <span className="muted"> {r.version}</span>
              </td>
              <td>{r.tech}</td>
              <td className="num">{r.bundleKb} KB</td>
              <td>
                <span className={`pill pill--${r.pptxFidelity}`}>
                  {FIDELITY_COPY[r.pptxFidelity].label}
                </span>
              </td>
              <td className="muted">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="legend">
        {(Object.keys(FIDELITY_COPY) as RendererEntry['pptxFidelity'][]).map((k) => (
          <div key={k}>
            <dt>
              <span className={`pill pill--${k}`}>{FIDELITY_COPY[k].label}</span>
            </dt>
            <dd>{FIDELITY_COPY[k].blurb}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
