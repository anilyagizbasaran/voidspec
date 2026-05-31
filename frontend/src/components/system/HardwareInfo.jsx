import React from 'react';
import { Cpu, Server, Thermometer } from 'lucide-react';

function InfoRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-panel-border/50 last:border-0">
      <span className="text-panel-muted text-xs">{label}</span>
      <span className="text-panel-text text-xs font-mono truncate max-w-[60%] text-right">{value}</span>
    </div>
  );
}

function formatUptime(seconds) {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

export default function HardwareInfo({ hardware, stats }) {
  if (!hardware && !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2].map(i => (
          <div key={i} className="bg-panel-surface border border-panel-border rounded-lg p-4 animate-pulse h-40" />
        ))}
      </div>
    );
  }

  const cpu = hardware?.cpu;
  const osInfo = hardware?.os;
  const loadAvg = stats?.cpu?.loadAvg || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* CPU Detail */}
      <div className="bg-panel-surface border border-panel-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cpu size={13} className="text-panel-muted" />
          <span className="text-panel-muted text-xs uppercase tracking-wider">CPU Info</span>
          {cpu?.temperature != null && (
            <span className={`ml-auto flex items-center gap-1 text-xs font-mono ${
              cpu.temperature > 80 ? 'text-panel-red' : cpu.temperature > 60 ? 'text-panel-yellow' : 'text-panel-green'
            }`}>
              <Thermometer size={11} />
              {cpu.temperature.toFixed(0)}°C
            </span>
          )}
        </div>
        <InfoRow label="Model" value={cpu ? `${cpu.manufacturer} ${cpu.brand}` : '—'} />
        <InfoRow label="Cores" value={cpu ? `${cpu.physicalCores} physical · ${cpu.cores} logical` : '—'} />
        <InfoRow label="Base freq" value={cpu?.speed ? `${cpu.speed} GHz` : '—'} />
        <InfoRow label="Load avg (1m)" value={loadAvg[0] != null ? loadAvg[0].toFixed(2) : '—'} />
        <InfoRow label="Load avg (5m)" value={loadAvg[1] != null ? loadAvg[1].toFixed(2) : '—'} />
        <InfoRow label="Load avg (15m)" value={loadAvg[2] != null ? loadAvg[2].toFixed(2) : '—'} />
      </div>

      {/* OS / System */}
      <div className="bg-panel-surface border border-panel-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Server size={13} className="text-panel-muted" />
          <span className="text-panel-muted text-xs uppercase tracking-wider">System</span>
        </div>
        <InfoRow label="Hostname" value={osInfo?.hostname || '—'} />
        <InfoRow label="OS" value={osInfo ? `${osInfo.distro} ${osInfo.release}` : '—'} />
        <InfoRow label="Kernel" value={osInfo?.kernel || '—'} />
        <InfoRow label="Arch" value={osInfo?.arch || '—'} />
        <InfoRow label="Uptime" value={formatUptime(stats?.uptime)} />
      </div>
    </div>
  );
}
