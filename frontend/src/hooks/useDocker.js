import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';

export function useContainers() {
  return useQuery({
    queryKey: ['docker-containers'],
    queryFn: () => client.get('/docker/containers').then(r => r.data),
    refetchInterval: 3000,
  });
}

export function useImages() {
  return useQuery({
    queryKey: ['docker-images'],
    queryFn: () => client.get('/docker/images').then(r => r.data),
    refetchInterval: 10000,
  });
}

export function useContainerAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, id }) => client.request({
      method: action === 'remove' ? 'DELETE' : 'POST',
      url: action === 'remove' ? `/docker/containers/${id}` : `/docker/containers/${id}/${action}`,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docker-containers'] }),
  });
}

export function useImageAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, id, image }) =>
      action === 'pull'
        ? client.post('/docker/images/pull', { image })
        : client.delete(`/docker/images/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docker-images'] }),
  });
}

// ── Container grupları ──────────────────────────────────────────────────────

export function useDockerGroups() {
  return useQuery({
    queryKey: ['docker-groups'],
    queryFn: () => client.get('/docker/groups').then(r => r.data),
    staleTime: 30000,
  });
}

export function useGroupMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ op, id, name, container, groupId }) => {
      if (op === 'create') return client.post('/docker/groups', { name });
      if (op === 'rename') return client.patch(`/docker/groups/${id}`, { name });
      if (op === 'delete') return client.delete(`/docker/groups/${id}`);
      return client.put('/docker/groups/assign', { container, groupId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docker-groups'] }),
  });
}

// Bir grubun tüm container'larına aynı işlemi uygular. Panelin kendi
// container'ları durdurma işleminden muaf (bkz. backend assertNotSelf).
export function useGroupAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, containers }) => {
      const targets = containers.filter(c => {
        if (action === 'stop') return c.state === 'running' && !c.self;
        if (action === 'start') return c.state !== 'running';
        return c.state === 'running' && !c.self;
      });
      const results = await Promise.allSettled(
        targets.map(c => client.post(`/docker/containers/${c.id}/${action}`)),
      );
      const failed = results
        .map((r, i) => (r.status === 'rejected' ? targets[i].name : null))
        .filter(Boolean);
      return { total: targets.length, failed };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['docker-containers'] }),
  });
}
