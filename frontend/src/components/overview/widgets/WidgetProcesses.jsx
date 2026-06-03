import React from 'react';
import { Cpu } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../../store/useStore.js';
import client from '../../../api/client.js';
import { StatusCard } from '../cards.jsx';

const WidgetProcesses = React.memo(function WidgetProcesses() {
  const { data: procs } = useQuery({
    queryKey: ['processes'],
    queryFn: () => client.get('/processes').then(r => r.data),
    refetchInterval: 10000,
  });
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
