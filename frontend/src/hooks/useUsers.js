import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';

const inv = qc => setTimeout(() => qc.invalidateQueries({ queryKey: ['users'] }), 600);

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => client.get('/users').then(r => r.data),
    refetchInterval: 30000,
  });
}

export function useUserDetail(username, enabled = false) {
  return useQuery({
    queryKey: ['user-detail', username],
    queryFn: () => client.get(`/users/${username}`).then(r => r.data),
    enabled: !!username && enabled,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: data => client.post('/users', data).then(r => r.data),
    onSuccess: () => inv(qc),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, removeHome }) =>
      client.delete(`/users/${username}?removeHome=${removeHome}`).then(r => r.data),
    onSuccess: () => inv(qc),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ username, password }) =>
      client.post(`/users/${username}/password`, { password }).then(r => r.data),
  });
}

export function useLockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, lock }) =>
      client.post(`/users/${username}/lock`, { lock }).then(r => r.data),
    onSuccess: () => inv(qc),
  });
}

export function useAddSSHKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, key }) =>
      client.post(`/users/${username}/ssh-keys`, { key }).then(r => r.data),
    onSuccess: (_, { username }) => {
      qc.invalidateQueries({ queryKey: ['user-detail', username] });
      inv(qc);
    },
  });
}

export function useDeleteSSHKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, idx }) =>
      client.delete(`/users/${username}/ssh-keys/${idx}`).then(r => r.data),
    onSuccess: (_, { username }) => {
      qc.invalidateQueries({ queryKey: ['user-detail', username] });
      inv(qc);
    },
  });
}
