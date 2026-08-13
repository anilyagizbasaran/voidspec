import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';

// Sunucu artık sıralayıp kırpılmış liste dönüyor; limit query key'in parçası,
// yoksa farklı limitle çalışan iki bileşen aynı cache girdisini eziyor.
//
// Widget'lar da bu hook'u kullanmalı: kendi useQuery'lerini ayrı key ile
// açtıklarında aynı pahalı endpoint birden fazla zamanlayıcıdan çağrılıyordu.
// Aynı key'i paylaşan gözlemcilerden React Query en kısa aralığı uygular.
export function useProcesses({ enabled = true, limit = 300, intervalMs = 5000 } = {}) {
  return useQuery({
    queryKey: ['processes', limit],
    queryFn: () => client.get('/processes', { params: { limit } }).then(r => r.data),
    // Tarama 1-2.5 saniye sürüyor; eski 3 saniyelik aralıkta istekler üst üste
    // biniyordu.
    refetchInterval: enabled ? intervalMs : false,
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
