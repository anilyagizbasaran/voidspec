import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { HardDrive } from 'lucide-react';
import { useSystemStats } from '../../../hooks/useSystemStats.js';
import { fmtBytes } from '../../../utils/format.js';
import { useWidgetSize, widgetBreakpoints } from '../WidgetSizeContext.js';

const MAX_PTS = 60;

const WidgetDiskIO = React.memo(function WidgetDiskIO() {
  const { data: stats } = useSystemStats();
  const [history, setHistory] = useState([]);
  const px = useWidgetSize();
  const bp = widgetBreakpoints(px);

  useEffect(() => {
    if (!stats?.diskIO) return;
    setHistory(prev => {
      const entry = {
        t: new Date().toLocaleTimeString('tr-TR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        read:  Math.round((stats.diskIO.readSec  || 0) / 1024),
        write: Math.round((stats.diskIO.writeSec || 0) / 1024),
        readRaw:  stats.diskIO.readSec  || 0,
        writeRaw: stats.diskIO.writeSec || 0,
      };
      const next = [...prev, entry];
      return next.length > MAX_PTS ? next.slice(-MAX_PTS) : next;
    });
  }, [stats]);

  const latest = history.at(-1);

  return (
    <div className="bg-panel-surface border border-panel-border rounded-md overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2">
          <HardDrive size={13} className="text-panel-muted" />
          <span className="text-[13px] font-medium text-panel-muted">
            {bp.compact ? 'Disk I/O' : 'Disk G/Ç geçmişi'}
          </span>
        </div>
        {latest && (
          <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
            <span className="text-panel-green">↓ {fmtBytes(latest.readRaw)}/s</span>
            {!bp.compact && <span className="text-panel-yellow">↑ {fmtBytes(latest.writeRaw)}/s</span>}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: bp.compact ? -30 : -10 }}>
            <defs>
              <linearGradient id="gdread" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3fcf6b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3fcf6b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gdwrite" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#eea53b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#eea53b" stopOpacity={0} />
              </linearGradient>
            </defs>
            {!bp.compact && (
              <XAxis dataKey="t" tick={{ fill: '#95a0aa', fontSize: 9 }} tickLine={false} axisLine={false} interval={14} />
            )}
            <YAxis tick={{ fill: '#95a0aa', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}k`} />
            <Tooltip
              contentStyle={{ background: '#222a32', border: '1px solid #36414c', borderRadius: 6, fontSize: 11, padding: '4px 8px' }}
              labelStyle={{ color: '#95a0aa', marginBottom: 2 }}
              formatter={(val, key, props) => {
                const raw = key === 'read' ? props.payload.readRaw : props.payload.writeRaw;
                return [`${fmtBytes(raw)}/s`, key === 'read' ? '↓ Okuma' : '↑ Yazma'];
              }}
            />
            <Area type="monotone" dataKey="read"  stroke="#3fcf6b" strokeWidth={1.5} fill="url(#gdread)"  dot={false} />
            <Area type="monotone" dataKey="write" stroke="#eea53b" strokeWidth={1.5} fill="url(#gdwrite)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export default WidgetDiskIO;
