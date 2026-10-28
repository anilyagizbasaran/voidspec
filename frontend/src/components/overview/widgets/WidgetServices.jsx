import React from 'react';
import { Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../../store/useStore.js';
import { useOpenPanel } from '../../../hooks/useOpenPanel.js';
import client from '../../../api/client.js';
import { StatusCard } from '../cards.jsx';

const WidgetServices = React.memo(function WidgetServices() {
  const { data: svcs } = useQuery({
    queryKey: ['services'],
    queryFn: () => client.get('/services').then(r => r.data),
    refetchInterval: 30000,
  });
  const openPanel = useOpenPanel();
  const active = svcs?.services?.filter(s => s.active === 'active').length;
  const failed = svcs?.services?.filter(s => s.active === 'failed').length ?? 0;
  return (
    <StatusCard
      icon={Activity}
      label="Services"
      value={active != null ? `${active} running` : '—'}
      sub={svcs ? `${failed} failed` : null}
      status={failed > 0 ? 'err' : active > 0 ? 'ok' : 'off'}
      onClick={() => openPanel('services')}
    />
  );
});

export default WidgetServices;
