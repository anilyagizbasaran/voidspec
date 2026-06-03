import React from 'react';
import { Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../../store/useStore.js';
import client from '../../../api/client.js';
import { StatusCard } from '../cards.jsx';

const WidgetFirewall = React.memo(function WidgetFirewall() {
  const { data: fw } = useQuery({
    queryKey: ['fw-status'],
    queryFn: () => client.get('/firewall/status').then(r => r.data),
    refetchInterval: 30000,
  });
  const setActiveTab = useStore(s => s.setActiveTab);
  const active = fw?.active;
  return (
    <StatusCard
      icon={Shield}
      label="Firewall"
      value={active == null ? 'Checking…' : active ? 'Enabled' : 'Disabled'}
      sub={active ? `${fw?.rules?.length ?? 0} rules active` : 'No protection'}
      status={active ? 'ok' : active === false ? 'err' : 'off'}
      onClick={() => setActiveTab('firewall')}
    />
  );
});

export default WidgetFirewall;
