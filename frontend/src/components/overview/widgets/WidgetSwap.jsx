import React from 'react';
import { Database } from 'lucide-react';
import { useSystemStats } from '../../../hooks/useSystemStats.js';
import { fmtBytes } from '../../../utils/format.js';
import { ResourceCard } from '../cards.jsx';
import { useSparkline, useTrend } from '../../../hooks/useSparkline.js';

const WidgetSwap = React.memo(function WidgetSwap() {
  const { data: stats } = useSystemStats();
  const swap = stats?.memory?.swap;
  const pct  = swap?.total > 0 ? Math.round((swap.used / swap.total) * 100) : null;
  const history = useSparkline(pct);
  const trend   = useTrend(history);

  if (swap && swap.total === 0) {
    return (
      <div className="bg-panel-surface border border-panel-border rounded-xl p-4 h-full flex flex-col items-center justify-center gap-2">
        <Database size={20} className="text-panel-muted/40" />
        <span className="text-xs text-panel-muted">Swap devre dışı</span>
      </div>
    );
  }

  return (
    <ResourceCard
      icon={Database}
      label="Swap"
      percent={pct}
      primary={pct != null ? `${pct}%` : '—'}
      secondary={swap ? `${fmtBytes(swap.used)} / ${fmtBytes(swap.total)}` : ''}
      accent="text-panel-yellow"
      sparkData={history}
      sparkColor="#d29922"
      trend={trend}
    />
  );
});

export default WidgetSwap;
