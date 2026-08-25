import { useState } from 'react';
import { formatCurrency } from '../../utils/format.js';

export default function RevenueCostChart({ data = [] }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!data || data.length === 0) return null;

  const MTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const W = 540, H = 210;
  const PAD = { t: 20, r: 20, b: 44, l: 68 };
  const CW = W - PAD.l - PAD.r;
  const CH = H - PAD.t - PAD.b;
  const n = data.length;

  const rev = data.map(d => d.revenue || 0);
  const cost = data.map(d => d.cost || 0);
  const maxV = Math.max(...rev, ...cost, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(maxV)));
  const niceMax = Math.ceil(maxV / mag) * mag || 1;

  const yP = v => PAD.t + CH * (1 - v / niceMax);
  const slotW = CW / n;
  const barW = Math.max(6, Math.min(22, slotW * 0.38));
  const gap = Math.max(3, barW * 0.3);
  const grpW = barW * 2 + gap;
  const xGrp = i => PAD.l + slotW * i + (slotW - grpW) / 2;

  const monthLabel = d => MTHS[(d.month || 1) - 1] + (d.year ? `'${String(d.year).slice(-2)}` : '');

  const TICKS = 5;
  const gridLines = Array.from({ length: TICKS + 1 }, (_, i) => {
    const v = niceMax * i / TICKS;
    return {
      y: yP(v),
      label: formatCurrency(v, 'short'),
    };
  });

  const hovered = hoverIdx != null ? data[hoverIdx] : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: H, display: 'block' }}
      >
        <defs>
          <linearGradient id="revenue-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--rose)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--rose)" stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD.l}
              x2={PAD.l + CW}
              y1={g.y}
              y2={g.y}
              stroke={i === 0 ? '#cbd5e1' : '#e2e8f0'}
              strokeWidth={i === 0 ? 1.5 : 0.7}
              strokeDasharray={i > 0 ? '4,3' : ''}
            />
            <text
              x={PAD.l - 8}
              y={g.y + 4}
              fontSize="9"
              fill="#94a3b8"
              textAnchor="end"
              fontFamily="sans-serif"
            >
              {g.label}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const rv = rev[i];
          const co = cost[i];
          const rh = rv ? Math.max(3, CH * rv / niceMax) : 0;
          const ch = co ? Math.max(3, CH * co / niceMax) : 0;
          const bx = xGrp(i);

          return (
            <g key={i}>
              {/* Revenue bar */}
              <rect
                x={bx}
                y={yP(rv)}
                width={barW}
                height={rh}
                rx="3"
                ry="3"
                fill="url(#revenue-grad)"
                cursor="pointer"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              />
              {/* Cost bar */}
              <rect
                x={bx + barW + gap}
                y={yP(co)}
                width={barW}
                height={ch}
                rx="3"
                ry="3"
                fill="#cbd5e1"
                cursor="pointer"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              />
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={xGrp(i) + grpW / 2}
            y={PAD.t + CH + 18}
            fontSize="9"
            fill="#64748b"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            {monthLabel(d)}
          </text>
        ))}
      </svg>

      {/* Hover tooltip */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            transform: 'translate(-50%, -100%)',
            left: `${(xGrp(hoverIdx) + grpW / 2) / W * 100}%`,
            top: `${yP(Math.max(hovered.revenue || 0, hovered.cost || 0)) / H * 100}%`,
            marginTop: '-10px',
            background: '#1e293b',
            color: '#f1f5f9',
            fontSize: '11px',
            fontWeight: 600,
            padding: '6px 11px',
            borderRadius: '7px',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,.35)',
            border: '1px solid #334155',
          }}
        >
          {monthLabel(hovered)} | Revenue: {formatCurrency(hovered.revenue || 0)} | Cost: {formatCurrency(hovered.cost || 0)}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '10px', paddingLeft: `${PAD.l}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--rose)' }} />
          Revenue
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#cbd5e1' }} />
          Cost
        </div>
      </div>
    </div>
  );
}
