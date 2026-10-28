import React from 'react';
import { HardDrive } from 'lucide-react';
import { useSystemStats } from '../../../hooks/useSystemStats.js';
import { useStore } from '../../../store/useStore.js';
import { useOpenPanel } from '../../../hooks/useOpenPanel.js';
import { useSparkline, useTrend } from '../../../hooks/useSparkline.js';
import { fmtBytes } from '../../../utils/format.js';
import { ResourceCard } from '../cards.jsx';

const WidgetDisk = React.memo(function WidgetDisk() {
  const { data: stats } = useSystemStats();
  const openPanel = useOpenPanel();
  const disk = stats?.disk?.[0];
  const history = useSparkline(disk?.percent);
  const trend = useTrend(history);
  return (
    <ResourceCard
      icon={HardDrive} label="Disk"
      percent={disk?.percent}
      primary={disk ? `${disk.percent?.toFixed(1)}%` : '—'}
      secondary={disk ? `${fmtBytes(disk.used)} / ${fmtBytes(disk.size)}` : ''}
      accent="text-panel-text"
      onClick={() => openPanel('files')}
      sparkData={history}
      sparkColor="#d8cfbd"
      trend={trend}
    />
  );
});

export default WidgetDisk;
