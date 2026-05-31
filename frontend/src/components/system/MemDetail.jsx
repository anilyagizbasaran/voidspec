import React from 'react';
import { MemoryStick } from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function MemBar({ label, used, total, color }) {
  if (!total) return null;
  const pct = Math.min(100, (used / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-panel-muted">{label}</span>
        <span className="text-panel-text font-mono">{formatBytes(used)} / {formatBytes(total)}</span>
      </div>
      <div className="h-1.5 bg-panel-hover rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MemSegment({ label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-sm ${color}`} />
      <span className="text-panel-muted text-xs">{label}</span>
      <span className="text-panel-text text-xs font-mono ml-auto">{formatBytes(value)}</span>
    </div>
  );
}

export default function MemDetail({ stats }) {
  if (!stats) return null;
  const mem = stats.memory;
  if (!mem) return null;

  return (
    <div className="bg-panel-surface border border-panel-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <MemoryStick size={13} className="text-panel-muted" />
        <span className="text-panel-muted text-xs uppercase tracking-wider">Memory Detail</span>
        <span className="ml-auto text-xs text-panel-muted font-mono">{formatBytes(mem.total)}</span>
      </div>

      <div className="space-y-3 mb-4">
        <MemBar label="RAM Used" used={mem.used} total={mem.total} color={mem.percent > 85 ? 'bg-panel-red' : mem.percent > 65 ? 'bg-panel-yellow' : 'bg-panel-cyan'} />
        {mem.swap?.total > 0 && (
          <MemBar
            label="Swap"
            used={mem.swap.used}
            total={mem.swap.total}
            color={mem.swap.used / mem.swap.total > 0.5 ? 'bg-panel-red' : 'bg-panel-yellow'}
          />
        )}
      </div>

      <div className="space-y-1.5 pt-3 border-t border-panel-border/50">
        <MemSegment label="Active" value={mem.active} color="bg-panel-cyan" />
        <MemSegment label="Buff/Cache" value={mem.buffcache} color="bg-panel-accent" />
        <MemSegment label="Free" value={mem.free} color="bg-panel-green" />
        {mem.swap?.total > 0 && (
          <MemSegment label="Swap Free" value={mem.swap.free} color="bg-panel-yellow/50" />
        )}
      </div>
    </div>
  );
}
