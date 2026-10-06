import React from 'react';
import { Network } from 'lucide-react';
import { useSystemStats } from '../../../hooks/useSystemStats.js';
import { useSparkline } from '../../../hooks/useSparkline.js';
import { fmtBytes } from '../../../utils/format.js';
import { netTotals } from '../../../utils/net.js';
import { ResourceCard } from '../cards.jsx';

const WidgetNetwork = React.memo(function WidgetNetwork() {
  const { data: stats } = useSystemStats();
  const { rx, tx } = netTotals(stats);
  const history = useSparkline(rx);
  return (
    <ResourceCard
      icon={Network} label="Ağ"
      percent={null}
      primary={`${fmtBytes(rx)}/s`}
      secondary={`↓ ${fmtBytes(rx)}/s  ↑ ${fmtBytes(tx)}/s`}
      accent="text-panel-text"
      sparkData={history}
      sparkColor="#d8cfbd"
    />
  );
});

export default WidgetNetwork;
