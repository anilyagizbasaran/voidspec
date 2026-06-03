import React from 'react';
import { HardDrive } from 'lucide-react';
import { useSystemStats } from '../../../hooks/useSystemStats.js';
import { useStore } from '../../../store/useStore.js';
import { useSparkline, useTrend } from '../../../hooks/useSparkline.js';
import { fmtBytes } from '../../../utils/format.js';
import { ResourceCard } from '../cards.jsx';

const WidgetDisk = React.memo(function WidgetDisk() {
  const { data: stats } = useSystemStats();
  const setActiveTab = useStore(s => s.setActiveTab);
  const disk = stats?.disk?.[0];
  const history = useSparkline(disk?.percent);
  const trend = useTrend(history);
  return (
    <ResourceCard
      icon={HardDrive} label="Disk"
      percent={disk?.percent}
      primary={disk ? `${disk.percent?.toFixed(1)}%` : '—'}
      secondary={disk ? `${fmtBytes(disk.used)} / ${fmtBytes(disk.size)}` : ''}
      accent="text-panel-accent"
      onClick={() => setActiveTab('files')}
      sparkData={history}
      sparkColor="#58a6ff"
      trend={trend}
    />
  );
});

export default WidgetDisk;
