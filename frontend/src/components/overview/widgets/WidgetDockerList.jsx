import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStore } from '../../../store/useStore.js';
import client from '../../../api/client.js';
import { Container, Play, Square, RotateCcw } from 'lucide-react';
import { useWidgetSize, widgetBreakpoints } from '../WidgetSizeContext.js';

function relativeTime(started) {
  if (!started) return '';
  const secs = Math.floor((Date.now() - new Date(started)) / 1000);
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h`;
}

const WidgetDockerList = React.memo(function WidgetDockerList() {
  const qc = useQueryClient();
  const setActiveTab = useStore(s => s.setActiveTab);
  const [pending, setPending] = useState({});

  const px = useWidgetSize();
  const bp = widgetBreakpoints(px);

  const { data: dock } = useQuery({
    queryKey: ['containers'],
    queryFn: () => client.get('/docker/containers').then(r => r.data),
    refetchInterval: 8000,
  });

  const containers = (Array.isArray(dock) ? dock : dock?.containers ?? [])
    .sort((a, b) => ({ running: 0, paused: 1, exited: 2 }[a.state] ?? 3) - ({ running: 0, paused: 1, exited: 2 }[b.state] ?? 3));

  async function doAction(id, action) {
    setPending(p => ({ ...p, [id]: action }));
    try {
      await client.post(`/docker/containers/${id}/${action}`);
      await qc.invalidateQueries({ queryKey: ['containers'] });
    } finally {
      setPending(p => { const n = { ...p }; delete n[id]; return n; });
    }
  }

  const running = containers.filter(c => c.state === 'running').length;

  return (
    <div className="bg-panel-surface border border-panel-border rounded-xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2">
          <Container size={13} className="text-panel-muted" />
          {!bp.compact && <span className="text-xs text-panel-muted tracking-wide">Docker Containers</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono">
            <span className="text-panel-green">{running}</span>
            <span className="text-panel-muted/50">/{containers.length}</span>
          </span>
          {!bp.compact && (
            <button onClick={() => setActiveTab('docker')} className="text-[11px] text-panel-muted/60 hover:text-panel-accent transition-colors">
              tümü →
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto divide-y divide-panel-border/30">
        {containers.length === 0 && (
          <div className="flex items-center justify-center py-8 text-panel-muted text-xs">Container yok</div>
        )}
        {containers.map(c => {
          const isRunning = c.state === 'running';
          const isPending = !!pending[c.id];
          return (
            <div key={c.id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-panel-hover/40 transition-colors">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                c.state === 'running' ? 'bg-panel-green' :
                c.state === 'paused'  ? 'bg-panel-yellow' : 'bg-panel-red/60'
              }`} />

              <div className="flex-1 min-w-0">
                <div className="text-xs text-panel-text font-mono truncate">
                  {c.name?.replace(/^\//, '')}
                </div>
                {!bp.compact && (
                  <div className="text-[10px] text-panel-muted truncate">
                    {c.image?.replace(/^sha256:/, '').slice(0, 28)}
                    {isRunning && c.startedAt && (
                      <span className="ml-1 text-panel-muted/40">{relativeTime(c.startedAt)}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                {isRunning ? (
                  <>
                    <button onClick={() => doAction(c.id, 'restart')} disabled={isPending} title="Yeniden başlat"
                      className="p-1.5 text-panel-muted/50 hover:text-panel-yellow disabled:opacity-40 transition-colors rounded hover:bg-panel-hover">
                      <RotateCcw size={11} className={isPending && pending[c.id] === 'restart' ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => doAction(c.id, 'stop')} disabled={isPending} title="Durdur"
                      className="p-1.5 text-panel-muted/50 hover:text-panel-red disabled:opacity-40 transition-colors rounded hover:bg-panel-hover">
                      <Square size={11} />
                    </button>
                  </>
                ) : (
                  <button onClick={() => doAction(c.id, 'start')} disabled={isPending} title="Başlat"
                    className="p-1.5 text-panel-muted/50 hover:text-panel-green disabled:opacity-40 transition-colors rounded hover:bg-panel-hover">
                    <Play size={11} className={isPending ? 'animate-pulse' : ''} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default WidgetDockerList;
