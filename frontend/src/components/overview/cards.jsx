import React from 'react';
import { ChevronRight } from 'lucide-react';
import { healthColor } from '../../utils/format.js';
import { Sparkline } from './Sparkline.jsx';
import { useWidgetSize, widgetBreakpoints } from './WidgetSizeContext.js';

export const ResourceCard = React.memo(function ResourceCard({
  icon: Icon, label, percent, primary, secondary, accent, onClick,
  sparkData, sparkColor, trend,
}) {
  const px  = useWidgetSize();
  const bp  = widgetBreakpoints(px);
  const hc  = percent != null
    ? healthColor(percent)
    : { text: accent, bar: accent.replace('text-', 'bg-') };

  /* tiny: just icon + number */
  if (bp.tiny) {
    return (
      <button
        onClick={onClick}
        className={`relative bg-panel-surface border border-panel-border rounded-xl p-3 text-left overflow-hidden w-full h-full flex flex-col justify-center
          ${onClick ? 'hover:bg-[#1c2128] cursor-pointer' : 'cursor-default'}`}
      >
        <div className={`absolute top-0 left-0 right-0 h-[2px] ${hc.bar} opacity-60`} />
        <div className="flex items-center gap-2">
          <Icon size={12} className={hc.text} />
          <span className={`text-xl font-bold font-mono ${hc.text}`}>{primary}</span>
        </div>
        <div className="text-panel-muted text-[10px] mt-0.5 truncate">{label}</div>
      </button>
    );
  }

  /* compact: number + secondary, no sparkline */
  const showSparkline = !bp.compact && sparkData?.length > 1;

  return (
    <button
      onClick={onClick}
      className={`group relative bg-panel-surface border border-panel-border rounded-xl p-4 text-left transition-all duration-200 overflow-hidden w-full h-full flex flex-col
        ${onClick ? 'hover:border-panel-border/80 hover:bg-[#1c2128] cursor-pointer hover:scale-[1.004]' : 'cursor-default'}`}
      style={{ transformOrigin: 'center' }}
    >
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${hc.bar} opacity-60`} />

      <div className="flex items-start justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-panel-hover">
            <Icon size={13} className={hc.text} />
          </div>
          <span className="text-panel-muted text-xs tracking-wide">{label}</span>
        </div>
        {trend != null && trend !== 0 ? (
          <span className={`text-[10px] font-mono tabular-nums ${trend > 0 ? 'text-panel-red' : 'text-panel-green'}`}>
            {trend > 0 ? `↑${trend.toFixed(1)}` : `↓${Math.abs(trend).toFixed(1)}`}
          </span>
        ) : onClick ? (
          <ChevronRight size={13} className="text-panel-muted/30 group-hover:text-panel-muted/70 transition-colors mt-0.5" />
        ) : null}
      </div>

      <div className={`text-2xl font-bold font-mono shrink-0 ${hc.text}`}>{primary}</div>
      <div className="text-panel-muted text-[11px] font-mono mt-0.5 truncate shrink-0">{secondary}</div>

      {showSparkline ? (
        <div className="mt-auto pt-2 -mx-1 w-[calc(100%+8px)]">
          <Sparkline data={sparkData} color={sparkColor} height={36} />
        </div>
      ) : percent != null ? (
        <div className="mt-3 h-1 bg-panel-hover rounded-full overflow-hidden shrink-0">
          <div
            className={`h-full rounded-full transition-all duration-700 ${hc.bar}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      ) : null}
    </button>
  );
});

export const StatusCard = React.memo(function StatusCard({ icon: Icon, label, value, sub, status, onClick }) {
  const px = useWidgetSize();
  const bp = widgetBreakpoints(px);

  const cfg = {
    ok:   { dot: 'bg-panel-green',  ring: 'border-panel-green/20',  bg: 'hover:bg-panel-green/5',  glow: 'shadow-[0_0_8px_rgba(63,185,80,0.12)]'  },
    warn: { dot: 'bg-panel-yellow', ring: 'border-panel-yellow/20', bg: 'hover:bg-panel-yellow/5', glow: '' },
    err:  { dot: 'bg-panel-red',    ring: 'border-panel-red/20',    bg: 'hover:bg-panel-red/5',    glow: 'shadow-[0_0_8px_rgba(248,81,73,0.12)]'  },
    off:  { dot: 'bg-panel-muted',  ring: 'border-panel-border',    bg: 'hover:bg-panel-hover',    glow: '' },
  }[status] || { dot: 'bg-panel-muted', ring: 'border-panel-border', bg: 'hover:bg-panel-hover', glow: '' };

  if (bp.tiny) {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-2 bg-panel-surface border ${cfg.ring} rounded-xl px-3 py-2 w-full h-full text-left transition-all ${cfg.bg} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
        <span className="text-panel-text text-xs font-medium truncate">{value}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-3 bg-panel-surface border ${cfg.ring} rounded-xl px-4 py-3 w-full h-full text-left transition-all duration-200 ${cfg.bg} ${cfg.glow} ${onClick ? 'cursor-pointer hover:scale-[1.004]' : 'cursor-default'}`}
      style={{ transformOrigin: 'center' }}
    >
      <div className="relative shrink-0">
        <Icon size={16} className="text-panel-muted" />
        <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${cfg.dot} ring-2 ring-panel-surface`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-panel-muted mb-0.5">{label}</div>
        <div className="text-panel-text text-xs font-medium truncate">{value}</div>
        {sub && !bp.compact && <div className="text-panel-muted text-[11px] truncate">{sub}</div>}
      </div>
      {onClick && <ChevronRight size={12} className="text-panel-muted/30 group-hover:text-panel-muted/70 shrink-0 transition-colors" />}
    </button>
  );
});
