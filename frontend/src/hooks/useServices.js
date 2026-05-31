import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: () => client.get('/services').then(r => r.data),
    refetchInterval: 8000,
  });
}

export function useServiceAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, action }) =>
      client.post(`/services/${name}/action`, { action }).then(r => r.data),
    onSuccess: () => {
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['services'] }), 1000);
    },
  });
}

export function useServiceLogs(name, enabled = false) {
  return useQuery({
    queryKey: ['service-logs', name],
    queryFn: () => client.get(`/services/${name}/logs?lines=150`).then(r => r.data),
    enabled: !!name && enabled,
    refetchInterval: enabled ? 5000 : false,
  });
}

export function useServiceStatus(name, enabled = false) {
  return useQuery({
    queryKey: ['service-status', name],
    queryFn: () => client.get(`/services/${name}/status`).then(r => r.data),
    enabled: !!name && enabled,
  });
}
