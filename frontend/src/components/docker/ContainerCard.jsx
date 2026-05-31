import React, { useState } from 'react';
import { Play, Square, RotateCcw, Trash2, ScrollText, ChevronDown, ChevronUp } from 'lucide-react';
import { useContainerAction } from '../../hooks/useDocker.js';
import ContainerLogs from './ContainerLogs.jsx';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function StateIndicator({ state }) {
  const colors = {
    running: 'bg-panel-green',
    exited: 'bg-panel-red',
    paused: 'bg-panel-yellow',
    created: 'bg-panel-muted',
  };
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[state] || 'bg-panel-muted'}`} />
  );
}

export default function ContainerCard({ container }) {
  const { mutate: action, isPending } = useContainerAction();
  const [showLogs, setShowLogs] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const isRunning = container.state === 'running';

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
    <div className="bg-panel-surface border border-panel-border rounded-lg overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <StateIndicator state={container.state} />
            <span className="text-panel-text font-medium text-sm truncate">{container.name}</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
            isRunning ? 'bg-panel-green/20 text-panel-green' :
            container.state === 'exited' ? 'bg-panel-red/20 text-panel-red' :
            'bg-panel-yellow/20 text-panel-yellow'
          }`}>
            {container.state}
          </span>
        </div>

        <div className="text-panel-muted text-xs truncate mb-3">{container.image}</div>

        {isRunning && (
          <div className="flex gap-4 mb-3 text-xs">
            <div>
              <span className="text-panel-muted">CPU </span>
              <span className="text-panel-text">{container.cpu?.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-panel-muted">MEM </span>
              <span className="text-panel-text">{formatBytes(container.memory?.used)}</span>
            </div>
            {container.ports?.length > 0 && (
              <div className="truncate">
                <span className="text-panel-muted">→ </span>
                <span className="text-panel-text">
                  {container.ports.filter(p => p.PublicPort).map(p => `${p.PublicPort}:${p.PrivatePort}`).join(', ')}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1">
          {isRunning ? (
            <button onClick={() => handleAction('stop')} disabled={isPending}
              className="flex items-center gap-1 px-2 py-1 text-xs text-panel-muted hover:text-panel-red hover:bg-panel-hover rounded transition-colors">
              <Square size={12} /> Stop
            </button>
          ) : (
            <button onClick={() => handleAction('start')} disabled={isPending}
              className="flex items-center gap-1 px-2 py-1 text-xs text-panel-muted hover:text-panel-green hover:bg-panel-hover rounded transition-colors">
              <Play size={12} /> Start
            </button>
          )}
          <button onClick={() => handleAction('restart')} disabled={isPending}
            className="flex items-center gap-1 px-2 py-1 text-xs text-panel-muted hover:text-panel-yellow hover:bg-panel-hover rounded transition-colors">
            <RotateCcw size={12} /> Restart
          </button>
          <button onClick={() => setShowLogs(v => !v)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-panel-muted hover:text-panel-cyan hover:bg-panel-hover rounded transition-colors">
            <ScrollText size={12} /> Logs
            {showLogs ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          <button onClick={() => handleAction('remove')} disabled={isPending}
            className={`ml-auto flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              confirmRemove ? 'text-white bg-panel-red' : 'text-panel-muted hover:text-panel-red hover:bg-panel-hover'
            }`}>
            <Trash2 size={12} />
            {confirmRemove ? 'Confirm' : 'Remove'}
          </button>
        </div>
      </div>

      {showLogs && <ContainerLogs id={container.id} />}
    </div>
  );
}
