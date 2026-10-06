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
      label="Süreçler"
      value={procs ? `${procs.total} süreç` : '—'}
      sub={procs ? `${procs.running} çalışıyor, ${procs.sleeping} bekliyor` : null}
      status="ok"
      onClick={() => setActiveTab('processes')}
    />
  );
});

export default WidgetProcesses;
