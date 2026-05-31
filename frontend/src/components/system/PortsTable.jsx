import React, { useState } from 'react';
import { Shield, RefreshCw } from 'lucide-react';
import { usePorts } from '../../hooks/useHardwareInfo.js';

const PROTOCOL_COLOR = {
  tcp: 'text-panel-accent',
  tcp6: 'text-panel-cyan',
  udp: 'text-panel-yellow',
  udp6: 'text-panel-yellow',
};

export default function PortsTable() {
  const { data, isLoading, refetch, isFetching } = usePorts();
  const [filter, setFilter] = useState('');

  const ports = (data?.ports || []).filter(p =>
    !filter ||
    String(p.localPort).includes(filter) ||
    p.process?.toLowerCase().includes(filter.toLowerCase()) ||
    p.protocol?.includes(filter.toLowerCase())
  );

  return (
    <div className="bg-panel-surface border border-panel-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield size={13} className="text-panel-muted" />
        <span className="text-panel-muted text-xs uppercase tracking-wider">Listening Ports</span>
        <span className="ml-1 text-panel-muted text-xs">({data?.ports?.length ?? '…'})</span>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto p-1 text-panel-muted hover:text-panel-text disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="mb-3">
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by port, process, protocol…"
          className="w-full bg-panel-bg border border-panel-border rounded px-3 py-1.5 text-xs text-panel-text placeholder-panel-muted focus:outline-none focus:border-panel-accent font-mono"
        />
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {[1,2,3,4].map(i => <div key={i} className="h-6 bg-panel-hover rounded animate-pulse" />)}
        </div>
      ) : ports.length === 0 ? (
        <p className="text-panel-muted text-xs py-2">{filter ? 'No matching ports' : 'No listening ports found'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-panel-muted border-b border-panel-border">
                <th className="text-left pb-2 font-normal">Proto</th>
                <th className="text-left pb-2 font-normal">Address</th>
                <th className="text-left pb-2 font-normal">Port</th>
                <th className="text-left pb-2 font-normal">Process</th>
                <th className="text-left pb-2 font-normal hidden sm:table-cell">PID</th>
              </tr>
            </thead>
            <tbody>
              {ports.map((p, i) => (
                <tr key={i} className="border-b border-panel-border/30 last:border-0 hover:bg-panel-hover/30">
                  <td className={`py-1.5 font-mono font-medium ${PROTOCOL_COLOR[p.protocol] || 'text-panel-muted'}`}>
                    {p.protocol}
                  </td>
                  <td className="py-1.5 font-mono text-panel-muted">
                    {p.localAddress || '*'}
                  </td>
                  <td className="py-1.5 font-mono text-panel-text font-semibold">
                    {p.localPort}
                  </td>
                  <td className="py-1.5 font-mono text-panel-text">
                    {p.process || <span className="text-panel-muted">—</span>}
                  </td>
                  <td className="py-1.5 font-mono text-panel-muted hidden sm:table-cell">
                    {p.pid || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
