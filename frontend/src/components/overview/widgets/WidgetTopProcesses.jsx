import React, { useState, useMemo } from 'react';
import { Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../../store/useStore.js';
import client from '../../../api/client.js';
import { fmtBytes } from '../../../utils/format.js';
import { useWidgetSize, widgetBreakpoints } from '../WidgetSizeContext.js';

const WidgetTopProcesses = React.memo(function WidgetTopProcesses() {
  const { data: procs } = useQuery({
    queryKey: ['processes'],
    queryFn: () => client.get('/processes').then(r => r.data),
    refetchInterval: 10000,
  });
  const setActiveTab = useStore(s => s.setActiveTab);
  const [sortBy, setSortBy] = useState('cpu');

  const px = useWidgetSize();
  const bp = widgetBreakpoints(px);

  const maxRows = bp.tiny ? 3 : bp.compact ? 4 : bp.tall ? 10 : 6;

  const sorted = useMemo(() => {
    if (!procs?.list) return [];
    return [...procs.list]
      .sort((a, b) => sortBy === 'cpu' ? (b.cpu || 0) - (a.cpu || 0) : (b.mem || 0) - (a.mem || 0))
      .slice(0, maxRows);
  }, [procs, sortBy, maxRows]);

  return (
    <div className="bg-panel-surface border border-panel-border rounded-xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-panel-muted" />
          {!bp.compact && <span className="text-xs text-panel-muted tracking-wide">Top Processes</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md overflow-hidden border border-panel-border text-[11px]">
            <button
              onClick={() => setSortBy('cpu')}
              className={`px-2 py-0.5 transition-colors ${sortBy === 'cpu' ? 'bg-panel-hover text-panel-text' : 'text-panel-muted hover:text-panel-text'}`}
            >CPU</button>
            <button
              onClick={() => setSortBy('mem')}
              className={`px-2 py-0.5 border-l border-panel-border transition-colors ${sortBy === 'mem' ? 'bg-panel-hover text-panel-text' : 'text-panel-muted hover:text-panel-text'}`}
            >MEM</button>
          </div>
          {!bp.compact && (
            <button onClick={() => setActiveTab('processes')} className="text-[11px] text-panel-muted/60 hover:text-panel-accent transition-colors">
              tümü →
            </button>
          )}
        </div>
      </div>
      <div className="divide-y divide-panel-border/40 overflow-auto flex-1">
        {sorted.map((p, i) => {
          const cpuColor = p.cpu > 50 ? 'text-panel-red' : p.cpu > 20 ? 'text-panel-yellow' : 'text-panel-muted';
          const memColor = p.mem > 500000 ? 'text-panel-red' : p.mem > 200000 ? 'text-panel-yellow' : 'text-panel-muted';
          return (
            <div key={p.pid} className="flex items-center gap-2 px-3 py-2 hover:bg-panel-hover/50 transition-colors">
              {!bp.compact && <span className="text-panel-muted/40 text-[10px] w-3 shrink-0">{i + 1}</span>}
              <span className="text-panel-text text-xs font-mono truncate flex-1">{p.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-mono tabular-nums ${sortBy === 'cpu' ? cpuColor : 'text-panel-muted'}`}>
                  {p.cpu?.toFixed(1)}%
                </span>
                {!bp.compact && (
                  <span className={`text-xs font-mono tabular-nums w-14 text-right ${sortBy === 'mem' ? memColor : 'text-panel-muted'}`}>
                    {fmtBytes((p.mem || 0) * 1024)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {!procs && <div className="px-4 py-6 text-center text-panel-muted text-xs">Yükleniyor…</div>}
      </div>
    </div>
  );
});

export default WidgetTopProcesses;
