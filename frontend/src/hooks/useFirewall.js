import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';

const inv = qc => setTimeout(() => qc.invalidateQueries({ queryKey: ['firewall'] }), 800);

export function useFirewallStatus() {
  return useQuery({
    queryKey: ['firewall'],
    queryFn: () => client.get('/firewall/status').then(r => r.data),
    refetchInterval: 10000,
  });
}

export function useFirewallEnable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post('/firewall/enable').then(r => r.data),
    onSuccess: () => inv(qc),
  });
}

export function useFirewallDisable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post('/firewall/disable').then(r => r.data),
    onSuccess: () => inv(qc),
  });
}

export function useAddRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: data => client.post('/firewall/rules', data).then(r => r.data),
    onSuccess: () => inv(qc),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: num => client.delete(`/firewall/rules/${num}`).then(r => r.data),
    onSuccess: () => inv(qc),
  });
}

export function useResetFirewall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post('/firewall/reset').then(r => r.data),
    onSuccess: () => inv(qc),
  });
}
