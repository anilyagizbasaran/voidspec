import React, { useState } from 'react';
import { Play, Square, RotateCcw, Trash2, ScrollText, ExternalLink } from 'lucide-react';
import { useContainerAction } from '../../hooks/useDocker.js';
import ContainerLogs from './ContainerLogs.jsx';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024, s = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(Math.max(bytes,1)) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k,i)).toFixed(1))} ${s[i]}`;
}

const STATE_CFG = {
  running: { dot: 'bg-panel-green', badge: 'text-panel-green bg-panel-green/10 border-panel-green/20', label: 'running' },
  exited:  { dot: 'bg-panel-red',   badge: 'text-panel-red   bg-panel-red/10   border-panel-red/20',   label: 'exited'  },
  paused:  { dot: 'bg-panel-yellow',badge: 'text-panel-yellow bg-panel-yellow/10 border-panel-yellow/20', label: 'paused' },
  created: { dot: 'bg-panel-muted', badge: 'text-panel-muted bg-panel-hover border-panel-border',       label: 'created' },
};

export default function ContainerCard({ container }) {
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
    <div className="bg-panel-surface border border-panel-border rounded-xl overflow-hidden flex flex-col">
      {/* Top accent line */}
      <div className={`h-[2px] ${isRunning ? 'bg-panel-green' : 'bg-panel-red'} opacity-60`} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot} ${isRunning ? 'shadow-[0_0_6px_currentColor]' : ''}`} />
            <span className="text-panel-text font-medium text-sm truncate">{container.name}</span>
          </div>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 font-mono ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>

        {/* Image */}
        <div className="text-panel-muted text-xs font-mono truncate">{container.image}</div>

        {/* Stats row (only when running) */}
        {isRunning && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-panel-bg rounded-lg px-2 py-1.5">
              <div className="text-panel-muted text-[10px] mb-0.5">CPU</div>
              <div className={`font-mono font-medium ${(container.cpu||0) > 50 ? 'text-panel-red' : (container.cpu||0) > 20 ? 'text-panel-yellow' : 'text-panel-green'}`}>
                {container.cpu?.toFixed(1) ?? '0.0'}%
              </div>
            </div>
            <div className="bg-panel-bg rounded-lg px-2 py-1.5">
              <div className="text-panel-muted text-[10px] mb-0.5">MEM</div>
              <div className="font-mono font-medium text-panel-cyan">{formatBytes(container.memory?.used)}</div>
            </div>
            <div className="bg-panel-bg rounded-lg px-2 py-1.5">
              <div className="text-panel-muted text-[10px] mb-0.5">PORTS</div>
              <div className="font-mono font-medium text-panel-text truncate">
                {ports.length ? ports.map(p => p.PublicPort).join(', ') : '—'}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 mt-auto pt-1 border-t border-panel-border/50">
          {isRunning ? (
            <button onClick={() => handleAction('stop')} disabled={isPending}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-panel-muted hover:text-panel-red hover:bg-panel-red/10 rounded-lg transition-colors">
              <Square size={11} /> Stop
            </button>
          ) : (
            <button onClick={() => handleAction('start')} disabled={isPending}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-panel-muted hover:text-panel-green hover:bg-panel-green/10 rounded-lg transition-colors">
              <Play size={11} /> Start
            </button>
          )}
          <button onClick={() => handleAction('restart')} disabled={isPending}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-panel-muted hover:text-panel-yellow hover:bg-panel-yellow/10 rounded-lg transition-colors">
            <RotateCcw size={11} /> Restart
          </button>
          <button onClick={() => setShowLogs(v => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg transition-colors ${showLogs ? 'text-panel-cyan bg-panel-cyan/10' : 'text-panel-muted hover:text-panel-cyan hover:bg-panel-cyan/10'}`}>
            <ScrollText size={11} /> Logs
          </button>
          <button onClick={() => handleAction('remove')} disabled={isPending}
            className={`ml-auto flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
              confirmRemove ? 'text-white bg-panel-red' : 'text-panel-muted hover:text-panel-red hover:bg-panel-red/10'
            }`}>
            <Trash2 size={11} />
            {confirmRemove ? 'Confirm?' : ''}
          </button>
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
