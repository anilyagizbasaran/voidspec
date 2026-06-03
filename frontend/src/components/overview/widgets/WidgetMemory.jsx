import React from 'react';
import { MemoryStick } from 'lucide-react';
import { useSystemStats } from '../../../hooks/useSystemStats.js';
import { useStore } from '../../../store/useStore.js';
import { useSparkline, useTrend } from '../../../hooks/useSparkline.js';
import { fmtBytes } from '../../../utils/format.js';
import { ResourceCard } from '../cards.jsx';

const WidgetMemory = React.memo(function WidgetMemory() {
  const { data: stats } = useSystemStats();
  const setActiveTab = useStore(s => s.setActiveTab);
  const mem = stats?.memory;
  const history = useSparkline(mem?.percent);
  const trend = useTrend(history);
  return (
    <ResourceCard
      icon={MemoryStick} label="Memory"
      percent={mem?.percent}
      primary={mem ? `${mem.percent}%` : '—'}
      secondary={mem ? `${fmtBytes(mem.used)} / ${fmtBytes(mem.total)}` : ''}
      accent="text-panel-cyan"
      onClick={() => setActiveTab('processes')}
      sparkData={history}
      sparkColor="#39c5cf"
      trend={trend}
    />
  );
});

export default WidgetMemory;
