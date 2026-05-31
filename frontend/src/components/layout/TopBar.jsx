import React from 'react';
import { LogOut, Server } from 'lucide-react';
import { useStore } from '../../store/useStore.js';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client.js';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

export default function TopBar() {
  const { user, clearUser } = useStore();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['system-stats'],
    queryFn: () => client.get('/system/stats').then(r => r.data),
    refetchInterval: 5000,
  });

  async function logout() {
    await client.post('/auth/logout');
    clearUser();
    navigate('/login');
  }

  const uptimeStr = stats?.uptime
    ? formatDistanceToNow(new Date(Date.now() - stats.uptime * 1000), { addSuffix: false })
    : '—';

  return (
    <header className="h-10 bg-panel-surface border-b border-panel-border flex items-center px-3 gap-2 shrink-0">
      <div className="flex items-center gap-1.5 text-panel-muted text-xs min-w-0">
        <Server size={12} className="shrink-0" />
        <span className="text-panel-text font-medium truncate">{stats?.hostname || 'server'}</span>
      </div>

      {/* uptime — hidden on small screens */}
      <div className="hidden sm:block text-panel-muted text-xs shrink-0">
        up {uptimeStr}
      </div>

      {stats && (
        <div className="flex items-center gap-2 text-xs shrink-0">
          <span>
            <span className="text-panel-muted">CPU </span>
            <span className={stats.cpu.load > 80 ? 'text-panel-red' : 'text-panel-green'}>{stats.cpu.load}%</span>
          </span>
          <span>
            <span className="text-panel-muted">RAM </span>
            <span className={stats.memory.percent > 85 ? 'text-panel-red' : 'text-panel-cyan'}>{stats.memory.percent}%</span>
          </span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden sm:block text-panel-muted text-xs">{user?.username}</span>
        <button
          onClick={logout}
          className="flex items-center gap-1 text-panel-muted hover:text-panel-red text-xs transition-colors"
        >
          <LogOut size={13} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
