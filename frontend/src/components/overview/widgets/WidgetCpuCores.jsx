import React from 'react';
import { Cpu } from 'lucide-react';
import { useSystemStats } from '../../../hooks/useSystemStats.js';
import { useWidgetSize, widgetBreakpoints } from '../WidgetSizeContext.js';

function coreColor(pct) {
  if (pct > 85) return { bar: 'bg-panel-red',    text: 'text-panel-red'    };
  if (pct > 60) return { bar: 'bg-panel-yellow', text: 'text-panel-yellow' };
  return             { bar: 'bg-panel-green',  text: 'text-panel-green'  };
}

const WidgetCpuCores = React.memo(function WidgetCpuCores() {
  const { data: stats } = useSystemStats();
  const px = useWidgetSize();
  const bp = widgetBreakpoints(px);

  const cores   = stats?.cpu?.perCore ?? [];
  const overall = stats?.cpu?.load;

  const cols = bp.wide ? 4 : bp.compact ? 2 : 2;
  const showLabel = !bp.compact;

  return (
    <div className="bg-panel-surface border border-panel-border rounded-xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2">
          <Cpu size={13} className="text-panel-muted" />
          <span className="text-xs text-panel-muted tracking-wide">Per-Core CPU</span>
        </div>
        {overall != null && (
          <span className={`text-[11px] font-mono tabular-nums font-semibold ${coreColor(overall).text}`}>
            ort. %{overall}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {cores.length === 0 ? (
          <div className="flex items-center justify-center h-full text-panel-muted text-xs">Yükleniyor…</div>
        ) : (
          <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {cores.map((pct, i) => {
              const c = coreColor(pct);
              return (
                <div key={i} className="flex flex-col gap-1">
                  {showLabel && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-panel-muted">C{i}</span>
                      <span className={`text-[10px] font-mono tabular-nums ${c.text}`}>{pct.toFixed(0)}%</span>
                    </div>
                  )}
                  <div className="h-1.5 bg-panel-hover rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${c.bar}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  {!showLabel && (
                    <span className={`text-[9px] font-mono text-center ${c.text}`}>{pct.toFixed(0)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

export default WidgetCpuCores;
