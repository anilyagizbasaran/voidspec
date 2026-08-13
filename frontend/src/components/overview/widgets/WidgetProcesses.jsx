import React from 'react';
import { Cpu } from 'lucide-react';
import { useStore } from '../../../store/useStore.js';
import { useProcesses } from '../../../hooks/useProcesses.js';
import { StatusCard } from '../cards.jsx';

const WidgetProcesses = React.memo(function WidgetProcesses() {
  const { data: procs } = useProcesses({ intervalMs: 10000 });
  const setActiveTab = useStore(s => s.setActiveTab);
  return (
    <StatusCard
      icon={Cpu}
      label="Processes"
      value={procs ? `${procs.total} total` : '—'}
      sub={procs ? `${procs.running} running · ${procs.sleeping} sleeping` : null}
      status="ok"
      onClick={() => setActiveTab('processes')}
    />
  );
});

export default WidgetProcesses;
