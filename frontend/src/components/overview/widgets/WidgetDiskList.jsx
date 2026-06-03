import React from 'react';
import { HardDrive } from 'lucide-react';
import { useSystemStats } from '../../../hooks/useSystemStats.js';
import { useStore } from '../../../store/useStore.js';
import { fmtBytes } from '../../../utils/format.js';
import { useWidgetSize, widgetBreakpoints } from '../WidgetSizeContext.js';

function DiskBar({ pct }) {
  const color = pct > 85 ? 'bg-panel-red' : pct > 65 ? 'bg-panel-yellow' : 'bg-panel-green';
  return (
    <div className="h-1 bg-panel-hover rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

const WidgetDiskList = React.memo(function WidgetDiskList() {
  const { data: stats } = useSystemStats();
  const setActiveTab = useStore(s => s.setActiveTab);
  const px = useWidgetSize();
  const bp = widgetBreakpoints(px);
  const disks = stats?.disk ?? [];

  return (
    <div className="bg-panel-surface border border-panel-border rounded-xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2">
          <HardDrive size={13} className="text-panel-muted" />
          {!bp.compact && <span className="text-xs text-panel-muted tracking-wide">Disk Kullanımı</span>}
        </div>
        <button onClick={() => setActiveTab('files')} className="text-[11px] text-panel-muted/60 hover:text-panel-accent transition-colors">
          dosyalar →
        </button>
      </div>

      <div className="flex-1 overflow-auto divide-y divide-panel-border/30">
        {disks.length === 0 && (
          <div className="flex items-center justify-center py-8 text-panel-muted text-xs">Disk bulunamadı</div>
        )}
        {disks.map((d, i) => {
          const pct = d.percent ?? 0;
          const textColor = pct > 85 ? 'text-panel-red' : pct > 65 ? 'text-panel-yellow' : 'text-panel-green';
          return (
            <div key={i} className="px-4 py-2.5 hover:bg-panel-hover/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-panel-text truncate">{d.mount ?? d.fs}</span>
                <span className={`text-xs font-mono font-bold ml-2 shrink-0 tabular-nums ${textColor}`}>
                  {pct.toFixed(1)}%
                </span>
              </div>
              <DiskBar pct={pct} />
              {!bp.compact && (
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-panel-muted">{fmtBytes(d.used)} kullanıldı</span>
                  <span className="text-[10px] text-panel-muted">{fmtBytes(d.size)} toplam</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default WidgetDiskList;
