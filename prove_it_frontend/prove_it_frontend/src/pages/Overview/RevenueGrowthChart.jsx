import { useState } from 'react';

const money = (value) => `$${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const W = 460, H = 200;
const PAD = { t: 16, r: 12, b: 28, l: 44 };
const CW = W - PAD.l - PAD.r;
const CH = H - PAD.t - PAD.b;

// Single series (this org-signup-date-anchored MRR trend) needs no legend — the
// panel title already names it — so this is the only hue in the chart, matching
// the app's existing --accent token rather than introducing a new color.
export default function RevenueGrowthChart({ points }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!points || points.length === 0) return null;

  const values = points.map(p => p.mrr);
  const maxV = Math.max(...values, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(maxV)));
  const niceMax = Math.ceil(maxV / mag) * mag || 1;

  const n = points.length;
  const xAt = i => PAD.l + (n === 1 ? CW / 2 : (CW * i) / (n - 1));
  const yAt = v => PAD.t + CH * (1 - v / niceMax);

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.mrr)}`).join(' ');
  const areaPath = `${linePath} L ${xAt(n - 1)} ${PAD.t + CH} L ${xAt(0)} ${PAD.t + CH} Z`;

  const TICKS = 3;
  const gridLines = Array.from({ length: TICKS + 1 }, (_, i) => {
    const v = (niceMax * i) / TICKS;
    return { y: yAt(v), label: money(v) };
  });

  const hovered = hoverIdx != null ? points[hoverIdx] : null;

  return (
    <div style={{ position: 'relative' }}>
      {/* preserveAspectRatio="none": the tooltip below positions itself with independent
          x/y percentages (left: x/W%, top: y/H%) — aspect-locked scaling (the SVG default)
          would letterbox the chart and throw that math off by the same margin. */}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
        <defs>
          <linearGradient id="revenue-growth-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--rose)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--rose)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD.l} x2={W - PAD.r} y1={g.y} y2={g.y}
              stroke="var(--line)" strokeWidth={i === 0 ? 1 : 0.75}
              strokeDasharray={i === 0 ? undefined : '3,3'}
            />
            <text x={PAD.l - 6} y={g.y + 3} fontSize="9" textAnchor="end" fill="var(--muted)">{g.label}</text>
          </g>
        ))}

        <path d={areaPath} fill="url(#revenue-growth-fill)" stroke="none" />
        <path d={linePath} fill="none" stroke="var(--rose)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {hovered && (
          <line
            x1={xAt(hoverIdx)} x2={xAt(hoverIdx)} y1={PAD.t} y2={PAD.t + CH}
            stroke="var(--line)" strokeWidth="1"
          />
        )}

        {points.map((p, i) => {
          const isLast = i === n - 1;
          const isHovered = i === hoverIdx;
          return (
            <g key={i}>
              {/* Generous invisible hit target — the visible dot stays small */}
              <circle
                cx={xAt(i)} cy={yAt(p.mrr)} r={12} fill="transparent"
                onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}
              />
              {(isLast || isHovered) && (
                <circle
                  cx={xAt(i)} cy={yAt(p.mrr)} r={isHovered ? 5 : 4}
                  fill="var(--rose)" stroke="var(--card)" strokeWidth="2"
                />
              )}
            </g>
          );
        })}

        {points.map((p, i) => (
          <text key={i} x={xAt(i)} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--muted)">{p.month}</text>
        ))}
      </svg>

      {hovered && (
        <div
          style={{
            position: 'absolute', pointerEvents: 'none', transform: 'translate(-50%, -100%)',
            left: `${(xAt(hoverIdx) / W) * 100}%`, top: `${(yAt(hovered.mrr) / H) * 100}%`,
            marginTop: -10, background: 'var(--ink)', color: '#fff', fontSize: 11, fontWeight: 600,
            padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap',
          }}
        >
          {hovered.month}: {money(hovered.mrr)}
        </div>
      )}
    </div>
  );
}
