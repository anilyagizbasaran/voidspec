import React from 'react';
import { useSystemStats } from '../../../hooks/useSystemStats.js';
import { useHardwareInfo } from '../../../hooks/useHardwareInfo.js';
import { fmtUptime } from '../../../utils/format.js';
import { useWidgetSize, widgetBreakpoints } from '../WidgetSizeContext.js';

const WidgetIdentityBar = React.memo(function WidgetIdentityBar() {
  const { data: stats }    = useSystemStats();
  const { data: hardware } = useHardwareInfo();
  const px = useWidgetSize();
  const bp = widgetBreakpoints(px);
  const temp = hardware?.cpu?.temperature;

  return (
    <div className="flex h-full items-center bg-panel-surface border border-panel-border rounded-xl px-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs w-full">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-panel-green animate-pulse shrink-0" />
          <span className="text-panel-text font-semibold tracking-wide">{hardware?.os?.hostname ?? '—'}</span>
        </div>

        {!bp.compact && (
          <>
            <span className="text-panel-border">|</span>
            <span className="text-panel-muted truncate max-w-[180px]">
              {hardware?.os ? `${hardware.os.distro} ${hardware.os.release}` : '—'}
            </span>
          </>
        )}

        {!bp.compact && (
          <>
            <span className="text-panel-border">|</span>
            <span className="text-panel-muted">
              kernel <span className="text-panel-text font-mono">{hardware?.os?.kernel ?? '—'}</span>
            </span>
          </>
        )}

        <span className="text-panel-border">|</span>
        <span className="text-panel-muted">
          up <span className="text-panel-green font-mono font-medium">{fmtUptime(stats?.uptime)}</span>
        </span>

        {!bp.compact && hardware?.cpu?.brand && (
          <>
            <span className="text-panel-border">|</span>
            <span className="text-panel-muted truncate max-w-[200px]">{hardware.cpu.brand}</span>
          </>
        )}

        {temp != null && (
          <>
            <span className="text-panel-border">|</span>
            <span className={`font-mono font-medium ${temp > 80 ? 'text-panel-red' : temp > 60 ? 'text-panel-yellow' : 'text-panel-muted'}`}>
              {temp.toFixed(0)}°C
            </span>
          </>
        )}
      </div>
    </div>
  );
});

export default WidgetIdentityBar;
