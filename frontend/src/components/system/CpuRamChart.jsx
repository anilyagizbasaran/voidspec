import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const MAX_POINTS = 60;

export default function CpuRamChart({ stats }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!stats) return;
    setHistory(prev => {
      const next = [...prev, {
        t: new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        cpu: stats.cpu.load,
        ram: stats.memory.percent,
      }];
      return next.slice(-MAX_POINTS);
    });
  }, [stats]);

  return (
    <div className="bg-panel-surface border border-panel-border rounded-md p-4">
      <h3 className="text-panel-muted text-sm font-medium mb-4">CPU & RAM, last 60 samples</h3>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={history} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="cpu" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3fcf6b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3fcf6b" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="ram" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#63bfd8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#63bfd8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" tick={{ fill: '#95a0aa', fontSize: 10 }} tickLine={false} axisLine={false} interval={9} />
          <YAxis domain={[0, 100]} tick={{ fill: '#95a0aa', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
          <Tooltip
            contentStyle={{ background: '#222a32', border: '1px solid #36414c', borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: '#95a0aa' }}
            formatter={(val, name) => [`${val.toFixed(1)}%`, name.toUpperCase()]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#95a0aa' }} />
          <Area type="monotone" dataKey="cpu" stroke="#3fcf6b" strokeWidth={1.5} fill="url(#cpu)" dot={false} name="CPU" />
          <Area type="monotone" dataKey="ram" stroke="#63bfd8" strokeWidth={1.5} fill="url(#ram)" dot={false} name="RAM" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
