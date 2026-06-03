import React, { useState } from 'react';
import { X, Check, LayoutGrid } from 'lucide-react';
import { WIDGET_REGISTRY } from './widgetRegistry.js';

/* ── Mini visual previews per widget (CSS only) ── */
function PreviewResourceCard({ color }) {
  const bars = [35, 55, 42, 68, 58, 75, 62, 80];
  return (
    <div className="flex flex-col gap-1.5 h-full justify-between p-1">
      <div className="flex items-end gap-0.5 h-8">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-sm opacity-60" style={{ height: `${h}%`, background: color }} />
        ))}
      </div>
      <div className="h-1 rounded-full opacity-30" style={{ background: color }} >
        <div className="h-full rounded-full w-[62%]" style={{ background: color, opacity: 1 }} />
      </div>
    </div>
  );
}

function PreviewSparkline({ color }) {
  const pts = [[0,70],[12,55],[24,68],[36,48],[50,60],[62,38],[76,50],[88,35],[100,42]];
  const h = 40;
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${(100 - y) * h / 100}`).join(' ');
  return (
    <div className="h-full flex items-center p-1">
      <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: h }}>
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        <circle cx={pts.at(-1)[0]} cy={(100 - pts.at(-1)[1]) * h / 100} r="3" fill={color} opacity="0.9" />
      </svg>
    </div>
  );
}

function PreviewDotRow({ colors }) {
  return (
    <div className="flex flex-col gap-1.5 justify-center h-full px-1">
      {colors.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
          <div className="h-1.5 rounded-full flex-1 opacity-25 bg-white" />
          <div className="h-1.5 rounded-full w-6 opacity-50" style={{ background: c }} />
        </div>
      ))}
    </div>
  );
}

function PreviewChart({ color1, color2 }) {
  const d1 = [40, 55, 45, 70, 60, 75, 55, 65, 80, 70];
  const d2 = [55, 60, 58, 62, 65, 60, 68, 63, 70, 65];
  const toPath = (arr) => {
    const w = 100 / (arr.length - 1);
    return arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * w},${40 - v * 0.35}`).join(' ');
  };
  return (
    <div className="h-full flex items-center p-1">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
        <path d={toPath(d1)} fill="none" stroke={color1} strokeWidth="1.5" opacity="0.7" />
        {color2 && <path d={toPath(d2)} fill="none" stroke={color2} strokeWidth="1.5" opacity="0.6" />}
      </svg>
    </div>
  );
}

function PreviewStatusCard({ colors }) {
  return (
    <div className="flex flex-col gap-1.5 justify-center h-full px-1">
      {colors.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
          <div className="h-1 rounded-full flex-1 opacity-20 bg-white" />
        </div>
      ))}
    </div>
  );
}

function PreviewBars({ color, values }) {
  return (
    <div className="grid gap-1 h-full content-center px-2 py-1" style={{ gridTemplateColumns: `repeat(${Math.min(values.length, 4)}, 1fr)` }}>
      {values.slice(0, 8).map((v, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <div className="h-8 flex items-end">
            <div className="w-full rounded-sm opacity-70" style={{ height: `${v}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PreviewPortRows() {
  return (
    <div className="flex flex-col gap-1 justify-center h-full px-2">
      {[22, 80, 443, 3000].map(port => (
        <div key={port} className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-panel-green w-8">{port}</span>
          <div className="h-1 rounded-full flex-1 opacity-20 bg-white" />
        </div>
      ))}
    </div>
  );
}

const PREVIEWS = {
  identity:     () => <div className="flex items-center gap-1.5 h-full px-1"><div className="w-2 h-2 rounded-full bg-panel-green animate-pulse" /><div className="h-1.5 rounded-full flex-1 opacity-20 bg-white" /><div className="h-1.5 rounded-full w-8 opacity-30 bg-white" /></div>,
  cpu:          ({ color }) => <PreviewResourceCard color={color} />,
  memory:       ({ color }) => <PreviewResourceCard color={color} />,
  disk:         ({ color }) => <PreviewResourceCard color={color} />,
  network:      ({ color }) => <PreviewSparkline color={color} />,
  firewall:     ({ color }) => <PreviewStatusCard colors={[color, '#30363d']} />,
  docker:       ({ color }) => <PreviewStatusCard colors={[color, '#30363d', '#30363d']} />,
  services:     ({ color }) => <PreviewStatusCard colors={[color, color, '#f85149']} />,
  processes:    ({ color }) => <PreviewStatusCard colors={['#7d8590', '#7d8590', '#7d8590']} />,
  topprocs:     ({ color }) => <PreviewDotRow colors={[color, color, '#d29922', '#f85149', color]} />,
  recentlogs:   ({ color }) => <PreviewDotRow colors={['#f85149', '#d29922', '#f85149', color, '#d29922']} />,
  cpuramchart:  ({ color }) => <PreviewChart color1={color} color2="#39c5cf" />,
  networkchart: ({ color }) => <PreviewChart color1="#58a6ff" color2="#d29922" />,
  dockerlist:   ({ color }) => <PreviewDotRow colors={[color, color, '#7d8590', '#f85149']} />,
  disklist:     ({ color }) => <PreviewResourceCard color={color} />,
  diskio:       ({ color }) => <PreviewChart color1={color} color2="#d29922" />,
  cpucores:     ({ color }) => <PreviewBars color={color} values={[35, 72, 28, 91, 45, 63, 18, 55]} />,
  swap:         ({ color }) => <PreviewSparkline color={color} />,
  ports:        ()           => <PreviewPortRows />,
};

const CATEGORIES = [
  { key: 'resources', label: 'Kaynaklar',  ids: ['cpu', 'memory', 'disk', 'network', 'swap'] },
  { key: 'status',    label: 'Durum',      ids: ['firewall', 'docker', 'services', 'processes'] },
  { key: 'charts',    label: 'Grafikler',  ids: ['cpuramchart', 'networkchart', 'diskio', 'cpucores'] },
  { key: 'lists',     label: 'Listeler',   ids: ['topprocs', 'recentlogs', 'dockerlist', 'disklist', 'ports'] },
];

function WidgetCard({ id, reg, active, onToggle }) {
  const Preview = PREVIEWS[id];
  const Icon = reg.icon;

  return (
    <button
      onClick={() => onToggle(id)}
      className={`group relative flex flex-col rounded-xl border text-left transition-all duration-150 overflow-hidden
        ${active
          ? 'border-panel-accent/40 bg-panel-accent/6 shadow-[0_0_16px_rgba(88,166,255,0.08)]'
          : 'border-panel-border bg-panel-surface hover:border-panel-border/80 hover:bg-panel-hover'
        }`}
    >
      {/* color line top */}
      <div className="h-[2px] w-full shrink-0" style={{ background: active ? reg.color : 'transparent', opacity: 0.7 }} />

      {/* preview area */}
      <div
        className="h-14 shrink-0 border-b border-panel-border/50 relative overflow-hidden"
        style={{ background: active ? `${reg.color}08` : 'transparent' }}
      >
        {Preview && <Preview color={reg.color} />}
      </div>

      {/* info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {Icon && (
              <Icon size={12} style={{ color: active ? reg.color : '#7d8590' }} className="shrink-0 transition-colors" />
            )}
            <span className={`text-xs font-medium truncate transition-colors ${active ? 'text-panel-text' : 'text-panel-muted'}`}>
              {reg.label}
            </span>
          </div>
          <div className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-all ${
            active ? 'text-panel-accent' : 'text-panel-muted/30 group-hover:text-panel-muted/60'
          }`} style={{ background: active ? `${reg.color}20` : undefined }}>
            {active ? <Check size={9} /> : <span className="text-[10px] leading-none">+</span>}
          </div>
        </div>

        {reg.description && (
          <p className="text-[10px] text-panel-muted/60 leading-snug line-clamp-2">{reg.description}</p>
        )}

        <div className="mt-auto pt-1 flex items-center justify-between">
          <span className="text-[9px] text-panel-muted/40 font-mono">
            {reg.defaultLayout.w}×{reg.defaultLayout.h}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
            active ? 'text-panel-green bg-panel-green/10' : 'text-panel-muted/40 bg-panel-hover'
          }`}>
            {active ? 'Aktif' : 'Gizli'}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function WidgetGallery({ visible, onToggle, onClose }) {
  const [filter, setFilter] = useState('all');
  const activeCount  = visible.length;
  const hiddenCount  = Object.keys(WIDGET_REGISTRY).length - activeCount;

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'rgba(13,17,23,0.97)', backdropFilter: 'blur(12px)' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-panel-accent/10 border border-panel-accent/20">
            <LayoutGrid size={15} className="text-panel-accent" />
          </div>
          <div>
            <h2 className="text-panel-text text-sm font-semibold">Widget Galerisi</h2>
            <p className="text-panel-muted text-xs mt-0.5">
              <span className="text-panel-green">{activeCount} aktif</span>
              {hiddenCount > 0 && <span className="text-panel-muted/60"> · {hiddenCount} gizli</span>}
            </p>
          </div>
        </div>

        {/* filter pills */}
        <div className="flex items-center gap-1.5 mr-4">
          {['all', 'active', 'hidden'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[11px] rounded-full transition-all ${
                filter === f
                  ? 'bg-panel-accent/15 border border-panel-accent/30 text-panel-accent'
                  : 'text-panel-muted/60 hover:text-panel-muted border border-transparent'
              }`}
            >
              {f === 'all' ? 'Tümü' : f === 'active' ? 'Aktif' : 'Gizli'}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="p-2 text-panel-muted hover:text-panel-text hover:bg-panel-hover rounded-lg transition-all"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-auto px-6 py-5 space-y-7">
        {CATEGORIES.map(cat => {
          const widgets = cat.ids
            .filter(id => WIDGET_REGISTRY[id])
            .filter(id => {
              if (filter === 'active') return visible.includes(id);
              if (filter === 'hidden') return !visible.includes(id);
              return true;
            });

          if (!widgets.length) return null;

          return (
            <div key={cat.key}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] uppercase tracking-widest text-panel-muted/50 font-medium">{cat.label}</span>
                <div className="flex-1 h-px bg-panel-border/40" />
                <span className="text-[10px] text-panel-muted/40">
                  {widgets.filter(id => visible.includes(id)).length}/{widgets.length}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {widgets.map(id => (
                  <WidgetCard
                    key={id}
                    id={id}
                    reg={WIDGET_REGISTRY[id]}
                    active={visible.includes(id)}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* empty filter state */}
        {CATEGORIES.every(cat =>
          cat.ids.filter(id => WIDGET_REGISTRY[id]).filter(id => {
            if (filter === 'active') return visible.includes(id);
            if (filter === 'hidden') return !visible.includes(id);
            return true;
          }).length === 0
        ) && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-panel-muted">
            <LayoutGrid size={28} className="opacity-20" />
            <p className="text-sm opacity-40">
              {filter === 'hidden' ? 'Tüm widget\'lar aktif!' : 'Widget bulunamadı'}
            </p>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="shrink-0 px-6 py-3 border-t border-panel-border flex items-center justify-between">
        <span className="text-[11px] text-panel-muted/50">Widget kartına tıkla → görünürlüğü değiştir</span>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-panel-accent/15 border border-panel-accent/30 rounded-lg text-panel-accent hover:bg-panel-accent/25 transition-all"
        >
          <Check size={11} />
          Tamam
        </button>
      </div>
    </div>
  );
}
