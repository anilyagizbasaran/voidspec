import { useQuery } from '@tanstack/react-query';
import client from '../api/client.js';

export function useSystemStats() {
  return useQuery({
    queryKey: ['system-stats'],
    queryFn: () => client.get('/system/stats').then(r => r.data),
    refetchInterval: 2000,
  });
}
