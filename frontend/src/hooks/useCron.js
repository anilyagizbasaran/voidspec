import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';

export function useCron() {
  return useQuery({
    queryKey: ['cron'],
    queryFn: () => client.get('/cron').then(r => r.data),
    refetchInterval: 15000,
  });
}

export function useAddCron() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: data => client.post('/cron', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cron'] }),
  });
}

export function useUpdateCron() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => client.put(`/cron/${encodeURIComponent(id)}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cron'] }),
  });
}

export function useDeleteCron() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: id => client.delete(`/cron/${encodeURIComponent(id)}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cron'] }),
  });
}
