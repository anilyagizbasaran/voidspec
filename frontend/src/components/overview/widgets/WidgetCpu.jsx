import React from 'react';
import { Cpu } from 'lucide-react';
import { useSystemStats } from '../../../hooks/useSystemStats.js';
import { useStore } from '../../../store/useStore.js';
import { useOpenPanel } from '../../../hooks/useOpenPanel.js';
import { useSparkline, useTrend } from '../../../hooks/useSparkline.js';
import { ResourceCard } from '../cards.jsx';

const WidgetCpu = React.memo(function WidgetCpu() {
  const { data: stats } = useSystemStats();
  const openPanel = useOpenPanel();
  const cpu = stats?.cpu;
  const history = useSparkline(cpu?.load);
  const trend = useTrend(history);
  return (
    <ResourceCard
      icon={Cpu} label="CPU"
      percent={cpu?.load}
      primary={cpu ? `${cpu.load}%` : '—'}
      secondary={cpu ? `${cpu.cores} cores, load ${cpu.loadAvg?.[0]?.toFixed(2) ?? '—'}` : ''}
      accent="text-panel-text"
      onClick={() => openPanel('processes')}
      sparkData={history}
      sparkColor="#d8cfbd"
      trend={trend}
    />
  );
});

export default WidgetCpu;
