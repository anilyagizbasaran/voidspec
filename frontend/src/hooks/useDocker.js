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
