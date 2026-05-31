import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';

const inv = qc => setTimeout(() => qc.invalidateQueries({ queryKey: ['packages'] }), 1000);

export function usePackages(search, offset = 0) {
  return useQuery({
    queryKey: ['packages', search, offset],
    queryFn: () => client.get('/packages', { params: { search, limit: 100, offset } }).then(r => r.data),
    keepPreviousData: true,
    staleTime: 30000,
  });
}

export function useUpgradable() {
  return useQuery({
    queryKey: ['packages-upgradable'],
    queryFn: () => client.get('/packages/upgradable').then(r => r.data),
    staleTime: 60000,
  });
}

export function usePackageInfo(name, enabled = false) {
  return useQuery({
    queryKey: ['package-info', name],
    queryFn: () => client.get(`/packages/${name}/info`).then(r => r.data),
    enabled: !!name && enabled,
    staleTime: 120000,
  });
}

export function useAptUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post('/packages/update').then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['packages-upgradable'] }); inv(qc); },
  });
}

export function useInstallPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: name => client.post('/packages/install', { name }).then(r => r.data),
    onSuccess: () => inv(qc),
  });
}

export function useRemovePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, purge }) =>
      client.delete(`/packages/${name}?purge=${purge}`).then(r => r.data),
    onSuccess: () => inv(qc),
  });
}

export function useUpgradePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: name => client.post('/packages/upgrade', name ? { name } : {}).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['packages-upgradable'] }); inv(qc); },
  });
}
