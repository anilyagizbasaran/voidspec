import { useQuery } from '@tanstack/react-query';
import client from '../api/client.js';

export function useHardwareInfo() {
  return useQuery({
    queryKey: ['hardware-info'],
    queryFn: () => client.get('/system/hardware').then(r => r.data),
    refetchInterval: 30000,
    staleTime: 20000,
  });
}

export function usePorts() {
  return useQuery({
    queryKey: ['system-ports'],
    queryFn: () => client.get('/system/ports').then(r => r.data),
    refetchInterval: 10000,
  });
}
