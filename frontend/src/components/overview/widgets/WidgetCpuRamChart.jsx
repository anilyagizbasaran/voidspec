import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useSystemStats } from '../../../hooks/useSystemStats.js';
import { useWidgetSize, widgetBreakpoints } from '../WidgetSizeContext.js';

const MAX_PTS = 60;

const WidgetCpuRamChart = React.memo(function WidgetCpuRamChart() {
  const { data: stats } = useSystemStats();
  const [history, setHistory] = useState([]);
  const px = useWidgetSize();
  const bp = widgetBreakpoints(px);

  useEffect(() => {
    if (!stats?.cpu || !stats?.memory) return;
    setHistory(prev => {
      const entry = {
        t: new Date().toLocaleTimeString('tr-TR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        cpu: parseFloat(stats.cpu.load.toFixed(1)),
        ram: parseFloat(stats.memory.percent.toFixed(1)),
      };
      const next = [...prev, entry];
      return next.length > MAX_PTS ? next.slice(-MAX_PTS) : next;
    });
  }, [stats]);

  const latest = history.at(-1);

  return (
    <div className="bg-panel-surface border border-panel-border rounded-xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border shrink-0">
        <span className="text-xs text-panel-muted tracking-wide">
          {bp.compact ? 'CPU & RAM' : 'CPU & RAM Geçmişi'}
        </span>
        {latest && (
          <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
            <span className="text-panel-green">CPU {latest.cpu}%</span>
            {!bp.compact && <span className="text-panel-cyan">RAM {latest.ram}%</span>}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: bp.compact ? -30 : -20 }}>
            <defs>
              <linearGradient id="gcpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3fb950" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3fb950" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gram" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#39c5cf" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#39c5cf" stopOpacity={0} />
              </linearGradient>
            </defs>
            {!bp.compact && (
              <XAxis dataKey="t" tick={{ fill: '#7d8590', fontSize: 9 }} tickLine={false} axisLine={false} interval={14} />
            )}
            <YAxis domain={[0, 100]} tick={{ fill: '#7d8590', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, fontSize: 11, padding: '4px 8px' }}
              labelStyle={{ color: '#7d8590', marginBottom: 2 }}
              formatter={(val, name) => [`${val}%`, name === 'cpu' ? 'CPU' : 'RAM']}
            />
            <Area type="monotone" dataKey="cpu" stroke="#3fb950" strokeWidth={1.5} fill="url(#gcpu)" dot={false} />
            <Area type="monotone" dataKey="ram" stroke="#39c5cf" strokeWidth={1.5} fill="url(#gram)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export default WidgetCpuRamChart;
