import React from 'react';
import { Network } from 'lucide-react';
import { useSystemStats } from '../../../hooks/useSystemStats.js';
import { useSparkline } from '../../../hooks/useSparkline.js';
import { fmtBytes } from '../../../utils/format.js';
import { ResourceCard } from '../cards.jsx';

const WidgetNetwork = React.memo(function WidgetNetwork() {
  const { data: stats } = useSystemStats();
  const rx = stats?.network?.reduce((s, n) => s + (n.rx || 0), 0) || 0;
  const tx = stats?.network?.reduce((s, n) => s + (n.tx || 0), 0) || 0;
  const history = useSparkline(rx);
  return (
    <ResourceCard
      icon={Network} label="Network"
      percent={null}
      primary={`${fmtBytes(rx)}/s`}
      secondary={`↓ ${fmtBytes(rx)}/s  ↑ ${fmtBytes(tx)}/s`}
      accent="text-panel-yellow"
      sparkData={history}
      sparkColor="#d29922"
    />
  );
});

export default WidgetNetwork;
