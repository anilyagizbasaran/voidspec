import { useQuery } from '@tanstack/react-query';
import { useRef, useEffect, useState, useCallback } from 'react';
import client from '../api/client.js';

export function useJournal(params, enabled = true) {
  return useQuery({
    queryKey: ['journal', params],
    queryFn: () => client.get('/logs/journal', { params }).then(r => r.data),
    enabled,
    staleTime: 5000,
    refetchInterval: params.follow ? false : 10000,
  });
}

export function useLogUnits() {
  return useQuery({
    queryKey: ['log-units'],
    queryFn: () => client.get('/logs/units').then(r => r.data),
    staleTime: 60000,
  });
}

export function useLogFiles() {
  return useQuery({
    queryKey: ['log-files'],
    queryFn: () => client.get('/logs/files').then(r => r.data),
    staleTime: 30000,
  });
}

export function useLogFile(name, params, enabled = false) {
  return useQuery({
    queryKey: ['log-file', name, params],
    queryFn: () => client.get(`/logs/file/${name}`, { params }).then(r => r.data),
    enabled: !!name && enabled,
    staleTime: 5000,
  });
}

// Real-time journal stream via WebSocket
export function useLogStream(params, active) {
  const [entries, setEntries] = useState([]);
  const wsRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (!active) return;

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const base  = `${proto}://${window.location.host}/api/logs/stream`;
    const qs    = new URLSearchParams();
    if (params.unit)     qs.set('unit', params.unit);
    if (params.priority) qs.set('priority', params.priority);

    const ws = new WebSocket(`${base}?${qs}`);
    ws.onmessage = e => {
      try {
        const entry = JSON.parse(e.data);
        setEntries(prev => [...prev.slice(-499), entry]);
      } catch {}
    };
    ws.onerror = () => {};
    wsRef.current = ws;
  }, [active, params.unit, params.priority]);

  useEffect(() => {
    setEntries([]);
    connect();
    return () => { wsRef.current?.close(); wsRef.current = null; };
  }, [connect]);

  const clear = useCallback(() => setEntries([]), []);
  return { entries, clear };
}
