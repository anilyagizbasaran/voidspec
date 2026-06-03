import React from 'react';
import { Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../../store/useStore.js';
import client from '../../../api/client.js';
import { useWidgetSize, widgetBreakpoints } from '../WidgetSizeContext.js';

const PCOLOR = { 0: 'text-panel-red', 1: 'text-panel-red', 2: 'text-panel-red', 3: 'text-panel-red', 4: 'text-panel-yellow' };

function fmtTs(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const WidgetRecentLogs = React.memo(function WidgetRecentLogs() {
  const { data } = useQuery({
    queryKey: ['overview-logs'],
    queryFn: () => client.get('/logs/journal', { params: { lines: 30, priority: 'warning' } }).then(r => r.data),
    refetchInterval: 15000,
  });
  const setActiveTab = useStore(s => s.setActiveTab);

  const px = useWidgetSize();
  const bp = widgetBreakpoints(px);
  const maxEntries = bp.tiny ? 3 : bp.compact ? 4 : bp.tall ? 12 : 7;

  return (
    <div className="bg-panel-surface border border-panel-border rounded-xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-panel-muted" />
          {!bp.compact && <span className="text-xs text-panel-muted tracking-wide">Recent Errors & Warnings</span>}
        </div>
        <button onClick={() => setActiveTab('logs')} className="text-[11px] text-panel-muted/60 hover:text-panel-accent transition-colors">
          tümü →
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {!data?.entries?.length ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span className="w-2 h-2 rounded-full bg-panel-green" />
            <span className="text-panel-muted text-xs">Hata veya uyarı yok</span>
          </div>
        ) : (
          <div className="divide-y divide-panel-border/40">
            {data.entries.slice(0, maxEntries).map((e, i) => (
              <div key={i} className="flex gap-3 px-4 py-2 hover:bg-panel-hover/50 transition-colors">
                {!bp.compact && (
                  <span className="text-panel-muted text-[10px] font-mono shrink-0 mt-0.5 w-16">{fmtTs(e.ts)}</span>
                )}
                <div className="flex-1 min-w-0">
                  {!bp.compact && <div className="text-panel-muted text-[10px] truncate mb-0.5">{e.unit}</div>}
                  <div className={`text-xs font-mono truncate ${PCOLOR[e.priority] ?? 'text-panel-text'}`}>{e.msg}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default WidgetRecentLogs;
