import React from 'react';
import { Container } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../../store/useStore.js';
import client from '../../../api/client.js';
import { StatusCard } from '../cards.jsx';

const WidgetDocker = React.memo(function WidgetDocker() {
  const { data: dock } = useQuery({
    queryKey: ['containers'],
    queryFn: () => client.get('/docker/containers').then(r => r.data),
    refetchInterval: 10000,
  });
  const setActiveTab = useStore(s => s.setActiveTab);
  const list = Array.isArray(dock) ? dock : dock?.containers ?? [];
  const running = list.filter(c => c.state === 'running').length;
  const total = list.length;
  return (
    <StatusCard
      icon={Container}
      label="Docker"
      value={dock != null ? `${running} / ${total} running` : '—'}
      sub={dock != null ? `${total - running} stopped` : null}
      status={running > 0 ? 'ok' : running === 0 && total > 0 ? 'warn' : 'off'}
      onClick={() => setActiveTab('docker')}
    />
  );
});

export default WidgetDocker;
