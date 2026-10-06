import React, { useState } from 'react';
import { Play, Square, RotateCcw, Trash2, ScrollText, ShieldCheck } from 'lucide-react';
import { useContainerAction } from '../../hooks/useDocker.js';
import ContainerLogs from './ContainerLogs.jsx';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024, s = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(Math.max(bytes,1)) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k,i)).toFixed(1))} ${s[i]}`;
}

const STATE_CFG = {
  running: { led: 'led-ok',   label: 'Çalışıyor' },
  exited:  { led: 'led-crit', label: 'Durdu' },
  paused:  { led: 'led-warn', label: 'Duraklatıldı' },
  created: { led: 'led-off',  label: 'Oluşturuldu' },
};

export default function ContainerCard({ container, groups = [], assignedGroupId = null, onAssign }) {
  const { mutate: action, isPending } = useContainerAction();
  const [showLogs, setShowLogs] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const isRunning = container.state === 'running';
  const cfg = STATE_CFG[container.state] || STATE_CFG.created;
  const ports = container.ports?.filter(p => p.PublicPort) || [];

  function handleAction(act) {
    if (act === 'remove' && !confirmRemove) {
      setConfirmRemove(true);
      setTimeout(() => setConfirmRemove(false), 3000);
      return;
    }
    action({ action: act, id: container.id });
    setConfirmRemove(false);
  }

  return (
    <div className="bg-panel-surface border border-panel-border rounded-md overflow-hidden flex flex-col">
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`led ${cfg.led} shrink-0`} />
            <span className="text-panel-text font-medium text-sm truncate font-mono">{container.name}</span>
            {container.self && (
              <span title="Panelin kendi container'ı: buradan durdurulamaz veya silinemez"
                className="flex items-center gap-1 text-[11px] text-panel-muted shrink-0">
                <ShieldCheck size={12} /> Panel
              </span>
            )}
          </div>
          {!isRunning && <span className="text-xs shrink-0 text-panel-red">{cfg.label}</span>}
        </div>

        {/* Image */}
        <div className="text-panel-muted text-xs font-mono truncate">{container.image}</div>

        {/* Stats row (only when running) */}
        {isRunning && (
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <div className="bg-panel-bg rounded px-2 py-1">
              <div className="text-panel-muted text-[11px] mb-0.5">CPU</div>
              <div className={`font-medium tabular-nums ${(container.cpu||0) > 50 ? 'text-panel-red' : (container.cpu||0) > 20 ? 'text-panel-yellow' : 'text-panel-text'}`}>
                {container.cpu?.toFixed(1) ?? '0.0'}%
              </div>
            </div>
            <div className="bg-panel-bg rounded px-2 py-1">
              <div className="text-panel-muted text-[11px] mb-0.5">Bellek</div>
              <div className="font-medium tabular-nums text-panel-text">{formatBytes(container.memory?.used)}</div>
            </div>
            <div className="bg-panel-bg rounded px-2 py-1">
              <div className="text-panel-muted text-[11px] mb-0.5">Portlar</div>
              <div className="font-medium tabular-nums text-panel-text truncate">
                {ports.length ? ports.map(p => p.PublicPort).join(', ') : '—'}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-1 mt-auto pt-2 border-t border-panel-border/50">
          {isRunning ? (!container.self && (
            <button onClick={() => handleAction('stop')} disabled={isPending}
              className="flex items-center gap-1 px-2 py-1.5 text-xs whitespace-nowrap text-panel-muted hover:text-panel-red hover:bg-panel-red/10 rounded transition-colors">
              <Square size={11} /> Durdur
            </button>
          )) : (
            <button onClick={() => handleAction('start')} disabled={isPending}
              className="flex items-center gap-1 px-2 py-1.5 text-xs whitespace-nowrap text-panel-muted hover:text-panel-green hover:bg-panel-green/10 rounded transition-colors">
              <Play size={11} /> Başlat
            </button>
          )}
          <button onClick={() => handleAction('restart')} disabled={isPending}
            className="flex items-center gap-1 px-2 py-1.5 text-xs whitespace-nowrap text-panel-muted hover:text-panel-yellow hover:bg-panel-yellow/10 rounded transition-colors">
            <RotateCcw size={11} /> Yeniden başlat
          </button>
          <button onClick={() => setShowLogs(v => !v)}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs whitespace-nowrap rounded transition-colors ${showLogs ? 'text-panel-cyan bg-panel-cyan/10' : 'text-panel-muted hover:text-panel-cyan hover:bg-panel-cyan/10'}`}>
            <ScrollText size={11} /> Loglar
          </button>
          {onAssign && (
            <select
              value={assignedGroupId || ''}
              onChange={e => onAssign(container.name, e.target.value || null)}
              aria-label={`${container.name} grubunu değiştir`}
              title="Grubu değiştir"
              className="ml-auto max-w-[10rem] min-w-0 bg-panel-bg border border-panel-border rounded px-1.5 py-1 text-xs text-panel-muted hover:text-panel-text focus:outline-none focus:border-panel-accent"
            >
              <option value="">{container.project ? `Otomatik: ${container.project}` : 'Otomatik'}</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          {!container.self && (
          <button onClick={() => handleAction('remove')} disabled={isPending}
            title="Container'ı sil" aria-label="Container'ı sil"
            className={`${onAssign ? '' : 'ml-auto'} flex items-center gap-1 px-2 py-1.5 text-xs whitespace-nowrap rounded transition-colors ${
              confirmRemove ? 'text-white bg-panel-red' : 'text-panel-muted hover:text-panel-red hover:bg-panel-red/10'
            }`}>
            <Trash2 size={11} />
            {confirmRemove ? 'Silinsin mi?' : ''}
          </button>
          )}
        </div>
      </div>

      {showLogs && (
        <div className="border-t border-panel-border">
          <ContainerLogs id={container.id} />
        </div>
      )}
    </div>
  );
}
