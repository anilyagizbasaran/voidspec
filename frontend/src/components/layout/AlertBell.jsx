import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Bell, BellRing, X, AlertTriangle, AlertOctagon, Settings, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import client from '../../api/client.js';

const THRESH_KEY = 'sp-alert-thresholds-v1';

const DEFAULT_THRESHOLDS = {
  cpu:  { warn: 70, crit: 85 },
  ram:  { warn: 80, crit: 90 },
  disk: { warn: 80, crit: 90 },
  swap: { warn: 60, crit: 80 },
};

function loadThresholds() {
  try {
    const raw = localStorage.getItem(THRESH_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return {
        cpu:  { ...DEFAULT_THRESHOLDS.cpu,  ...saved.cpu  },
        ram:  { ...DEFAULT_THRESHOLDS.ram,  ...saved.ram  },
        disk: { ...DEFAULT_THRESHOLDS.disk, ...saved.disk },
        swap: { ...DEFAULT_THRESHOLDS.swap, ...saved.swap },
      };
    }
  } catch {}
  return DEFAULT_THRESHOLDS;
}

function computeAlerts(stats, svcs, thresholds, dismissed) {
  const alerts = [];

  const add = (id, severity, msg, detail = '') => {
    if (!dismissed.has(id)) alerts.push({ id, severity, msg, detail });
  };

  const cpu = stats?.cpu?.load;
  if (cpu >= thresholds.cpu.crit)       add('cpu_crit', 'crit', `CPU %${cpu} — kritik yük`,    `Eşik: %${thresholds.cpu.crit}`);
  else if (cpu >= thresholds.cpu.warn)  add('cpu_warn', 'warn', `CPU %${cpu} — yüksek`,        `Eşik: %${thresholds.cpu.warn}`);

  const ram = stats?.memory?.percent;
  if (ram >= thresholds.ram.crit)       add('ram_crit', 'crit', `RAM %${ram} — kritik`,        `Eşik: %${thresholds.ram.crit}`);
  else if (ram >= thresholds.ram.warn)  add('ram_warn', 'warn', `RAM %${ram} — yüksek`,        `Eşik: %${thresholds.ram.warn}`);

  stats?.disk?.forEach((d, i) => {
    const v = d.percent ?? 0;
    const mount = d.mount || d.fs;
    if (v >= thresholds.disk.crit)      add(`disk_crit_${i}`, 'crit', `${mount} %${v.toFixed(0)} dolu`, `Eşik: %${thresholds.disk.crit}`);
    else if (v >= thresholds.disk.warn) add(`disk_warn_${i}`, 'warn', `${mount} %${v.toFixed(0)} dolu`, `Eşik: %${thresholds.disk.warn}`);
  });

  const swap = stats?.memory?.swap;
  if (swap?.total > 0) {
    const pct = Math.round((swap.used / swap.total) * 100);
    if (pct >= thresholds.swap.crit)    add('swap_crit', 'crit', `Swap %${pct} dolu`,          `Eşik: %${thresholds.swap.crit}`);
    else if (pct >= thresholds.swap.warn) add('swap_warn', 'warn', `Swap %${pct} dolu`,        `Eşik: %${thresholds.swap.warn}`);
  }

  svcs?.services?.filter(s => s.active === 'failed').forEach(s => {
    add(`svc_${s.name}`, 'crit', `${s.name} servisi başarısız`, 'systemd: failed');
  });

  return alerts;
}

/* ── Threshold settings panel ── */
function ThresholdSettings({ thresholds, onChange, onClose }) {
  const [local, setLocal] = useState(thresholds);

  function set(key, level, val) {
    const n = { ...local, [key]: { ...local[key], [level]: Number(val) } };
    setLocal(n);
    onChange(n);
    try { localStorage.setItem(THRESH_KEY, JSON.stringify(n)); } catch {}
  }

  const rows = [
    { key: 'cpu',  label: 'CPU'   },
    { key: 'ram',  label: 'RAM'   },
    { key: 'disk', label: 'Disk'  },
    { key: 'swap', label: 'Swap'  },
  ];

  return (
    <div className="px-3 py-3 border-t border-panel-border">
      <div className="text-[10px] uppercase tracking-widest text-panel-muted/50 mb-2.5">Eşik Değerleri (%)</div>
      {rows.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-2 mb-2">
          <span className="text-xs text-panel-muted w-10 shrink-0">{label}</span>
          <div className="flex items-center gap-1 flex-1">
            <span className="text-[10px] text-panel-yellow/70">⚠</span>
            <input type="number" min={0} max={100} value={local[key].warn}
              onChange={e => set(key, 'warn', e.target.value)}
              className="w-14 bg-panel-bg border border-panel-border rounded px-1.5 py-0.5 text-xs font-mono text-panel-text text-center focus:outline-none focus:border-panel-yellow/50"
            />
          </div>
          <div className="flex items-center gap-1 flex-1">
            <span className="text-[10px] text-panel-red/70">✕</span>
            <input type="number" min={0} max={100} value={local[key].crit}
              onChange={e => set(key, 'crit', e.target.value)}
              className="w-14 bg-panel-bg border border-panel-border rounded px-1.5 py-0.5 text-xs font-mono text-panel-text text-center focus:outline-none focus:border-panel-red/50"
            />
          </div>
        </div>
      ))}
      <button onClick={onClose}
        className="mt-1 w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-panel-green bg-panel-green/10 rounded-lg hover:bg-panel-green/20 transition-colors">
        <Check size={11} /> Tamam
      </button>
    </div>
  );
}

/* ── Main component ── */
export default function AlertBell() {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());
  const [thresholds, setThresholds] = useState(loadThresholds);
  const panelRef = useRef(null);

  const { data: stats } = useQuery({ queryKey: ['system-stats'], queryFn: () => client.get('/system/stats').then(r => r.data), refetchInterval: 5000 });
  const { data: svcs  } = useQuery({ queryKey: ['services'],     queryFn: () => client.get('/services').then(r => r.data),      refetchInterval: 30000 });

  const alerts = useMemo(() => computeAlerts(stats, svcs, thresholds, dismissed), [stats, svcs, thresholds, dismissed]);

  const critCount = alerts.filter(a => a.severity === 'crit').length;
  const warnCount = alerts.filter(a => a.severity === 'warn').length;
  const total = alerts.length;

  useEffect(() => {
    if (!open) return;
    function onOut(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
        setShowSettings(false);
      }
    }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, [open]);

  function dismiss(id) {
    setDismissed(prev => new Set([...prev, id]));
  }

  function dismissAll() {
    setDismissed(prev => new Set([...prev, ...alerts.map(a => a.id)]));
    setOpen(false);
  }

  const badgeColor = critCount > 0 ? 'bg-panel-red' : warnCount > 0 ? 'bg-panel-yellow' : 'bg-panel-green';
  const BellIcon   = total > 0 ? BellRing : Bell;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen(p => !p); setShowSettings(false); }}
        className={`relative flex items-center justify-center w-7 h-7 rounded-md transition-all
          ${open ? 'bg-panel-hover text-panel-text' : 'text-panel-muted/50 hover:text-panel-muted hover:bg-panel-hover'}`}
        title="Uyarılar"
      >
        <BellIcon size={14} className={total > 0 ? (critCount > 0 ? 'text-panel-red' : 'text-panel-yellow') : ''} />
        {total > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full text-[9px] font-bold text-white flex items-center justify-center ${badgeColor}`}>
            {total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-panel-surface border border-panel-border rounded-xl shadow-xl z-[200] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-panel-border">
            <span className="text-xs font-medium text-panel-text">
              {total === 0 ? 'Uyarı yok' : `${total} uyarı`}
            </span>
            <div className="flex items-center gap-1">
              {total > 0 && (
                <button onClick={dismissAll}
                  className="text-[10px] text-panel-muted/60 hover:text-panel-accent px-1.5 py-0.5 rounded transition-colors">
                  tümünü kapat
                </button>
              )}
              <button onClick={() => setShowSettings(p => !p)}
                className={`p-1 rounded transition-colors ${showSettings ? 'text-panel-accent' : 'text-panel-muted/50 hover:text-panel-muted'}`}>
                <Settings size={12} />
              </button>
            </div>
          </div>

          {/* Alert list */}
          {!showSettings && (
            <div className="max-h-72 overflow-auto">
              {total === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <span className="w-8 h-8 rounded-full bg-panel-green/10 flex items-center justify-center">
                    <Check size={16} className="text-panel-green" />
                  </span>
                  <span className="text-xs text-panel-muted">Tüm metrikler normal</span>
                </div>
              ) : (
                <div className="divide-y divide-panel-border/50">
                  {alerts.map(a => (
                    <div key={a.id} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-panel-hover/40 transition-colors">
                      {a.severity === 'crit'
                        ? <AlertOctagon size={14} className="text-panel-red shrink-0 mt-0.5" />
                        : <AlertTriangle size={14} className="text-panel-yellow shrink-0 mt-0.5" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-panel-text">{a.msg}</div>
                        {a.detail && <div className="text-[10px] text-panel-muted mt-0.5">{a.detail}</div>}
                      </div>
                      <button onClick={() => dismiss(a.id)}
                        className="shrink-0 text-panel-muted/40 hover:text-panel-muted transition-colors mt-0.5">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Threshold settings */}
          {showSettings && (
            <ThresholdSettings
              thresholds={thresholds}
              onChange={setThresholds}
              onClose={() => setShowSettings(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
