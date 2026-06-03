import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LogOut, Server, Settings, GripVertical } from 'lucide-react';
import AlertBell from './AlertBell.jsx';
import { useStore } from '../../store/useStore.js';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client.js';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

/* ── Metric definitions ── */
function fmtBytes(b) {
  if (!b) return '0 B';
  const k = 1024, s = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(Math.max(b,1)) / Math.log(k));
  return `${parseFloat((b / Math.pow(k,i)).toFixed(1))} ${s[i]}`;
}

const METRICS = {
  cpu:     {
    label: 'CPU',
    get: (s) => s?.cpu?.load     != null ? `${s.cpu.load}%`                    : null,
    color: (s) => s?.cpu?.load     > 80 ? 'text-panel-red' : s?.cpu?.load     > 50 ? 'text-panel-yellow' : 'text-panel-green',
  },
  ram:     {
    label: 'RAM',
    get: (s) => s?.memory?.percent != null ? `${s.memory.percent}%`            : null,
    color: (s) => s?.memory?.percent > 85 ? 'text-panel-red' : s?.memory?.percent > 65 ? 'text-panel-yellow' : 'text-panel-cyan',
  },
  disk:    {
    label: 'Disk',
    get: (s) => s?.disk?.[0]?.percent != null ? `${s.disk[0].percent.toFixed(1)}%` : null,
    color: (s) => s?.disk?.[0]?.percent > 85 ? 'text-panel-red' : s?.disk?.[0]?.percent > 65 ? 'text-panel-yellow' : 'text-panel-accent',
  },
  network: {
    label: 'Net',
    get: (s) => {
      const rx = s?.network?.reduce((a, n) => a + (n.rx || 0), 0);
      return rx != null ? `${fmtBytes(rx)}/s` : null;
    },
    color: () => 'text-panel-yellow',
  },
};

/* ── Persistence ── */
const STORAGE_KEY = 'sp-topbar-v1';
const DEFAULT_CONFIG = { order: ['cpu', 'ram', 'disk', 'network'], visible: ['cpu', 'ram'] };

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const { order, visible } = JSON.parse(raw);
      const known = Object.keys(METRICS);
      return {
        order:   Array.isArray(order)   ? order.filter(id => known.includes(id))   : DEFAULT_CONFIG.order,
        visible: Array.isArray(visible) ? visible.filter(id => known.includes(id)) : DEFAULT_CONFIG.visible,
      };
    }
  } catch {}
  return DEFAULT_CONFIG;
}

function saveConfig(cfg) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {}
}

/* ── Metric pill ── */
function StatPill({ label, value, colorClass }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-panel-hover border border-panel-border text-xs shrink-0">
      <span className="text-panel-muted">{label}</span>
      <span className={`font-semibold font-mono tabular-nums ${colorClass}`}>{value}</span>
    </div>
  );
}

/* ── Config popover ── */
function MetricConfig({ config, onConfigChange, onClose }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [localCfg, setLocalCfg] = useState(config);

  function commit(next) {
    setLocalCfg(next);
    onConfigChange(next);
  }

  function toggleVisible(id) {
    const visible = localCfg.visible.includes(id)
      ? localCfg.visible.filter(v => v !== id)
      : [...localCfg.visible, id];
    commit({ ...localCfg, visible });
  }

  function onDragStart(i) {
    setDragIdx(i);
  }

  function onDragOver(e, i) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const order = [...localCfg.order];
    const [moved] = order.splice(dragIdx, 1);
    order.splice(i, 0, moved);
    setDragIdx(i);
    commit({ ...localCfg, order });
  }

  function onDragEnd() {
    setDragIdx(null);
  }

  return (
    <div className="absolute top-full right-0 mt-2 w-52 bg-panel-surface border border-panel-border rounded-xl shadow-xl z-[200] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-panel-border">
        <span className="text-[10px] uppercase tracking-widest text-panel-muted/60 font-medium">Metrikler</span>
        <span className="text-[10px] text-panel-muted/40">sürükle → sırala</span>
      </div>

      <div className="p-2 flex flex-col gap-0.5">
        {localCfg.order.map((id, i) => {
          const m = METRICS[id];
          const active = localCfg.visible.includes(id);
          const isDragging = dragIdx === i;
          return (
            <div
              key={id}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={(e) => onDragOver(e, i)}
              onDragEnd={onDragEnd}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-all select-none
                ${isDragging ? 'opacity-40 bg-panel-hover' : 'hover:bg-panel-hover'}`}
            >
              <GripVertical size={13} className="text-panel-muted/30 shrink-0" />

              <span className={`flex-1 text-xs font-medium ${active ? 'text-panel-text' : 'text-panel-muted/50'}`}>
                {m.label}
              </span>

              {/* Toggle switch */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleVisible(id); }}
                className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${active ? 'bg-panel-accent' : 'bg-panel-hover border border-panel-border'}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200
                  ${active ? 'right-0.5 bg-white' : 'left-0.5 bg-panel-muted/40'}`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── TopBar ── */
export default function TopBar() {
  const { user, clearUser } = useStore();
  const navigate = useNavigate();
  const [config, setConfig] = useState(loadConfig);
  const [showConfig, setShowConfig] = useState(false);
  const configRef = useRef(null);

  const { data: stats } = useQuery({
    queryKey: ['system-stats'],
    queryFn: () => client.get('/system/stats').then(r => r.data),
    refetchInterval: 5000,
  });

  /* Close popover on outside click */
  useEffect(() => {
    if (!showConfig) return;
    function onClickOutside(e) {
      if (configRef.current && !configRef.current.contains(e.target)) {
        setShowConfig(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showConfig]);

  const handleConfigChange = useCallback((next) => {
    setConfig(next);
    saveConfig(next);
  }, []);

  async function logout() {
    await client.post('/auth/logout');
    clearUser();
    navigate('/login');
  }

  const uptimeStr = stats?.uptime
    ? formatDistanceToNow(new Date(Date.now() - stats.uptime * 1000), { addSuffix: false })
    : null;

  /* Render pills in order, only visible ones */
  const pills = config.order
    .filter(id => config.visible.includes(id))
    .map(id => {
      const m = METRICS[id];
      const value = m.get(stats);
      if (!value) return null;
      return { id, label: m.label, value, color: m.color(stats) };
    })
    .filter(Boolean);

  return (
    <header className="h-12 bg-panel-surface border-b border-panel-border flex items-center px-4 gap-3 shrink-0">

      {/* Hostname */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-panel-green dot-green-glow shrink-0" />
        <div className="flex items-center gap-1.5 text-xs min-w-0">
          <Server size={11} className="text-panel-muted shrink-0" />
          <span className="text-panel-text font-semibold truncate">{stats?.hostname || '—'}</span>
        </div>
      </div>

      {/* Uptime */}
      {uptimeStr && (
        <span className="hidden lg:block text-panel-muted text-xs shrink-0">
          up <span className="text-panel-text">{uptimeStr}</span>
        </span>
      )}

      {/* Divider */}
      {pills.length > 0 && <div className="hidden sm:block w-px h-4 bg-panel-border shrink-0" />}

      {/* Metric pills */}
      <div className="hidden sm:flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
        {pills.map(p => (
          <StatPill key={p.id} label={p.label} value={p.value} colorClass={p.color} />
        ))}
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2 shrink-0">

        {/* Mobile quick stats */}
        {stats && (
          <div className="flex sm:hidden items-center gap-1.5 text-xs">
            {pills.slice(0, 2).map(p => (
              <span key={p.id} className={`font-mono font-semibold ${p.color}`}>{p.value}</span>
            ))}
          </div>
        )}

        {/* Alert bell */}
        <AlertBell />

        <div className="w-px h-4 bg-panel-border" />

        {/* Config button */}
        <div className="relative" ref={configRef}>
          <button
            onClick={() => setShowConfig(p => !p)}
            title="Metrikleri özelleştir"
            className={`flex items-center justify-center w-7 h-7 rounded-md transition-all
              ${showConfig
                ? 'bg-panel-accent/15 text-panel-accent'
                : 'text-panel-muted/50 hover:text-panel-muted hover:bg-panel-hover'}`}
          >
            <Settings size={13} className={showConfig ? 'animate-[spin_0.2s_ease-out]' : ''} />
          </button>

          {showConfig && (
            <MetricConfig
              config={config}
              onConfigChange={handleConfigChange}
              onClose={() => setShowConfig(false)}
            />
          )}
        </div>

        <div className="w-px h-4 bg-panel-border" />

        {/* User */}
        <div className="hidden sm:flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-panel-accent/15 flex items-center justify-center">
            <span className="text-panel-accent text-[10px] font-bold uppercase">
              {user?.username?.[0] ?? 'A'}
            </span>
          </div>
          <span className="text-panel-muted text-xs">{user?.username}</span>
        </div>

        <div className="w-px h-4 bg-panel-border hidden sm:block" />

        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-panel-muted hover:text-panel-red text-xs transition-colors px-2 py-1 rounded hover:bg-panel-red/10"
          title="Logout"
        >
          <LogOut size={13} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
