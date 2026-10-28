import React from 'react';
import { Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../../store/useStore.js';
import { useOpenPanel } from '../../../hooks/useOpenPanel.js';
import client from '../../../api/client.js';
import { StatusCard } from '../cards.jsx';

const WidgetFirewall = React.memo(function WidgetFirewall() {
  // Firewall paneliyle aynı key: ayrı key'ler (['fw-status'] / ['firewall'])
  // React Query'nin tekilleştirmesini engelliyor, aynı pahalı endpoint iki
  // ayrı zamanlayıcıdan çağrılıyordu.
  const { data: fw } = useQuery({
    queryKey: ['firewall'],
    queryFn: () => client.get('/firewall/status').then(r => r.data),
    refetchInterval: 30000,
  });
  const openPanel = useOpenPanel();
  const active = fw?.active;
  return (
    <StatusCard
      icon={Shield}
      label="Firewall"
      value={active == null ? 'Checking…' : active ? 'Enabled' : 'Disabled'}
      sub={active ? `${fw?.rules?.length ?? 0} active rules` : 'Server unprotected'}
      status={active ? 'ok' : active === false ? 'err' : 'off'}
      onClick={() => openPanel('firewall')}
    />
  );
});

export default WidgetFirewall;
