import React, { useState, useEffect } from 'react';
import { Network, Wifi, Circle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const MAX_POINTS = 60;

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes.toFixed(0)} B/s`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB/s`;
}

function formatBytesTotal(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function NetworkPanel({ stats, hardware }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!stats?.network) return;
    const totalRx = stats.network.reduce((s, n) => s + (n.rx || 0), 0);
    const totalTx = stats.network.reduce((s, n) => s + (n.tx || 0), 0);
    setHistory(prev => {
      const next = [...prev, {
        t: new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        rx: Math.round(totalRx / 1024),
        tx: Math.round(totalTx / 1024),
      }];
      return next.slice(-MAX_POINTS);
    });
  }, [stats]);

  const ifaces = hardware?.network || [];
  const statsMap = Object.fromEntries((stats?.network || []).map(n => [n.iface, n]));

  return (
    <div className="space-y-3">
      {/* Bandwidth Chart */}
      <div className="bg-panel-surface border border-panel-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Network size={13} className="text-panel-muted" />
          <span className="text-panel-muted text-xs uppercase tracking-wider">Network Bandwidth — Last 60s</span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={history} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="rx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3fb950" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3fb950" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="tx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f0883e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f0883e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" tick={{ fill: '#8b949e', fontSize: 10 }} tickLine={false} axisLine={false} interval={9} />
            <YAxis tick={{ fill: '#8b949e', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}K`} />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, fontSize: 11 }}
              labelStyle={{ color: '#8b949e' }}
              formatter={(val, name) => [`${val} KB/s`, name === 'rx' ? '↓ Download' : '↑ Upload']}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#8b949e' }}
              formatter={name => name === 'rx' ? '↓ Download' : '↑ Upload'}
            />
            <Area type="monotone" dataKey="rx" stroke="#3fb950" strokeWidth={1.5} fill="url(#rx)" dot={false} name="rx" />
            <Area type="monotone" dataKey="tx" stroke="#f0883e" strokeWidth={1.5} fill="url(#tx)" dot={false} name="tx" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Interface Table */}
      <div className="bg-panel-surface border border-panel-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wifi size={13} className="text-panel-muted" />
          <span className="text-panel-muted text-xs uppercase tracking-wider">Network Interfaces</span>
        </div>

        {ifaces.length === 0 && !stats?.network?.length ? (
          <p className="text-panel-muted text-xs">No interfaces found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-panel-muted border-b border-panel-border">
                  <th className="text-left pb-2 font-normal">Interface</th>
                  <th className="text-left pb-2 font-normal">IP</th>
                  <th className="text-left pb-2 font-normal hidden md:table-cell">MAC</th>
                  <th className="text-right pb-2 font-normal">↓ Down</th>
                  <th className="text-right pb-2 font-normal">↑ Up</th>
                  <th className="text-right pb-2 font-normal hidden lg:table-cell">Total RX</th>
                  <th className="text-right pb-2 font-normal hidden lg:table-cell">Total TX</th>
                </tr>
              </thead>
              <tbody>
                {(ifaces.length > 0 ? ifaces : stats?.network || []).map(iface => {
                  const live = statsMap[iface.iface] || iface;
                  const up = iface.operstate === 'up' || live.rx != null;
                  return (
                    <tr key={iface.iface} className="border-b border-panel-border/30 last:border-0">
                      <td className="py-2 font-mono">
                        <div className="flex items-center gap-2">
                          <Circle
                            size={6}
                            className={up ? 'text-panel-green fill-panel-green' : 'text-panel-muted fill-panel-muted'}
                          />
                          {iface.iface}
                          {iface.speed ? <span className="text-panel-muted">({iface.speed}M)</span> : null}
                        </div>
                      </td>
                      <td className="py-2 font-mono text-panel-text">{iface.ip4 || '—'}</td>
                      <td className="py-2 font-mono text-panel-muted hidden md:table-cell">{iface.mac || '—'}</td>
                      <td className="py-2 text-right text-panel-green font-mono">{formatBytes(live.rx)}</td>
                      <td className="py-2 text-right font-mono" style={{ color: '#f0883e' }}>{formatBytes(live.tx)}</td>
                      <td className="py-2 text-right text-panel-muted font-mono hidden lg:table-cell">{formatBytesTotal(live.rxTotal)}</td>
                      <td className="py-2 text-right text-panel-muted font-mono hidden lg:table-cell">{formatBytesTotal(live.txTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
