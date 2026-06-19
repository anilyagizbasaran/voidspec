import { useQuery } from '@tanstack/react-query';
import client from '../api/client.js';

export function useLoginHistory(limit = 200) {
  return useQuery({
    queryKey: ['login-history', limit],
    queryFn: () => client.get(`/auth/history?limit=${limit}`).then(r => r.data),
    refetchInterval: 15000,
  });
}
