import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useSystemStats } from '../../../hooks/useSystemStats.js';
import { fmtBytes } from '../../../utils/format.js';
import { useWidgetSize, widgetBreakpoints } from '../WidgetSizeContext.js';

const MAX_PTS = 60;

const WidgetNetworkChart = React.memo(function WidgetNetworkChart() {
  const { data: stats } = useSystemStats();
  const [history, setHistory] = useState([]);
  const px = useWidgetSize();
  const bp = widgetBreakpoints(px);

  useEffect(() => {
    if (!stats?.network) return;
    const rx = Math.round(stats.network.reduce((s, n) => s + (n.rx || 0), 0));
    const tx = Math.round(stats.network.reduce((s, n) => s + (n.tx || 0), 0));
    setHistory(prev => {
      const entry = { t: new Date().toLocaleTimeString('tr-TR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }), rx: Math.round(rx / 1024), tx: Math.round(tx / 1024), rxRaw: rx, txRaw: tx };
      const next = [...prev, entry];
      return next.length > MAX_PTS ? next.slice(-MAX_PTS) : next;
    });
  }, [stats]);

  const latest = history.at(-1);

  return (
    <div className="bg-panel-surface border border-panel-border rounded-xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border shrink-0">
        <span className="text-xs text-panel-muted tracking-wide">
          {bp.compact ? 'Network' : 'Network Geçmişi'}
        </span>
        {latest && (
          <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
            <span className="text-panel-accent">↓ {fmtBytes(latest.rxRaw)}/s</span>
            {!bp.compact && <span className="text-panel-yellow">↑ {fmtBytes(latest.txRaw)}/s</span>}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: bp.compact ? -30 : -10 }}>
            <defs>
              <linearGradient id="gnrx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#58a6ff" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#58a6ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gntx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#d29922" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#d29922" stopOpacity={0} />
              </linearGradient>
            </defs>
            {!bp.compact && (
              <XAxis dataKey="t" tick={{ fill: '#7d8590', fontSize: 9 }} tickLine={false} axisLine={false} interval={14} />
            )}
            <YAxis tick={{ fill: '#7d8590', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}k`} />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, fontSize: 11, padding: '4px 8px' }}
              labelStyle={{ color: '#7d8590', marginBottom: 2 }}
              formatter={(val, key, props) => {
                const raw = key === 'rx' ? props.payload.rxRaw : props.payload.txRaw;
                return [`${fmtBytes(raw)}/s`, key === 'rx' ? '↓ RX' : '↑ TX'];
              }}
            />
            <Area type="monotone" dataKey="rx" stroke="#58a6ff" strokeWidth={1.5} fill="url(#gnrx)" dot={false} />
            <Area type="monotone" dataKey="tx" stroke="#d29922" strokeWidth={1.5} fill="url(#gntx)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export default WidgetNetworkChart;
