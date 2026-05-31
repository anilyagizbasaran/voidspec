import React from 'react';
import { Cpu, MemoryStick, HardDrive, Network } from 'lucide-react';

function formatBytes(bytes, decimals = 1) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

function StatCard({ icon: Icon, label, value, sub, percent, color = 'text-panel-accent' }) {
  return (
    <div className="bg-panel-surface border border-panel-border rounded-lg p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <Icon size={13} className="text-panel-muted shrink-0" />
        <span className="text-panel-muted text-xs uppercase tracking-wider truncate">{label}</span>
      </div>
      <div className={`text-xl sm:text-2xl font-semibold mb-1 ${color}`}>{value}</div>
      {sub && <div className="text-panel-muted text-xs truncate">{sub}</div>}
      {percent !== undefined && (
        <div className="mt-2 sm:mt-3 h-1 bg-panel-hover rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              percent > 85 ? 'bg-panel-red' : percent > 65 ? 'bg-panel-yellow' : 'bg-panel-green'
            }`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function StatsGrid({ stats }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-panel-surface border border-panel-border rounded-lg p-4 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  const netRx = stats.network?.reduce((s, n) => s + (n.rx || 0), 0) || 0;
  const netTx = stats.network?.reduce((s, n) => s + (n.tx || 0), 0) || 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        icon={Cpu}
        label="CPU"
        value={`${stats.cpu.load}%`}
        sub={`${stats.cpu.cores} cores · avg ${stats.cpu.loadAvg?.[0]?.toFixed(2) ?? stats.loadAvg?.[0]?.toFixed(2) ?? '—'}`}
        percent={stats.cpu.load}
        color={stats.cpu.load > 80 ? 'text-panel-red' : 'text-panel-green'}
      />
      <StatCard
        icon={MemoryStick}
        label="Memory"
        value={`${stats.memory.percent}%`}
        sub={`${formatBytes(stats.memory.used)} / ${formatBytes(stats.memory.total)}`}
        percent={stats.memory.percent}
        color={stats.memory.percent > 85 ? 'text-panel-red' : 'text-panel-cyan'}
      />
      <StatCard
        icon={HardDrive}
        label="Disk"
        value={`${stats.disk?.[0]?.percent?.toFixed(1) || 0}%`}
        sub={`${formatBytes(stats.disk?.[0]?.used)} / ${formatBytes(stats.disk?.[0]?.size)}`}
        percent={stats.disk?.[0]?.percent || 0}
        color="text-panel-accent"
      />
      <StatCard
        icon={Network}
        label="Network"
        value={`↓ ${formatBytes(netRx)}/s`}
        sub={`↑ ${formatBytes(netTx)}/s`}
        color="text-panel-yellow"
      />
    </div>
  );
}
