import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';

export function useProcesses(enabled = true) {
  return useQuery({
    queryKey: ['processes'],
    queryFn: () => client.get('/processes').then(r => r.data),
    refetchInterval: enabled ? 3000 : false,
    enabled,
  });
}

export function useKillProcess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pid, signal }) =>
      client.post(`/processes/${pid}/kill`, { signal }).then(r => r.data),
    onSuccess: () => {
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['processes'] }), 500);
    },
  });
}
