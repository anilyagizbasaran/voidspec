import React, { useId } from 'react';

export function Sparkline({ data, color = '#3fb950', height = 40 }) {
  const uid = useId().replace(/:/g, '');

  if (!data || data.length < 2) {
    return <div style={{ height }} className="w-full" />;
  }

  const W = 100;
  const H = height;
  const pad = 3; // top/bottom padding in px so the dot isn't clipped
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: pad + (1 - (v - min) / range) * (H - pad * 2),
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const fillPath = `${linePath} L${pts.at(-1).x.toFixed(2)},${H} L0,${H} Z`;
  const last = pts.at(-1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full block"
      style={{ height }}
    >
      <defs>
        <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0}    />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#sg-${uid})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="2.5" fill={color} />
    </svg>
  );
}
