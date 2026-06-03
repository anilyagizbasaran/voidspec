import React, { useState, useMemo } from 'react';
import { Network, Search } from 'lucide-react';
import { usePorts } from '../../../hooks/useHardwareInfo.js';
import { useWidgetSize, widgetBreakpoints } from '../WidgetSizeContext.js';

const KNOWN_PORTS = {
  22: 'SSH', 80: 'HTTP', 443: 'HTTPS', 3306: 'MySQL',
  5432: 'Postgres', 6379: 'Redis', 27017: 'MongoDB',
  8080: 'HTTP-alt', 8443: 'HTTPS-alt', 3000: 'Node',
  5000: 'Flask', 9090: 'Prometheus', 3001: 'Node-alt',
};

const WidgetPorts = React.memo(function WidgetPorts() {
  const { data } = usePorts();
  const px = useWidgetSize();
  const bp = widgetBreakpoints(px);
  const [search, setSearch] = useState('');

  const ports = useMemo(() => {
    const list = data?.ports ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(p =>
      String(p.localPort).includes(q) ||
      p.process?.toLowerCase().includes(q) ||
      KNOWN_PORTS[p.localPort]?.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="bg-panel-surface border border-panel-border rounded-xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2">
          <Network size={13} className="text-panel-muted" />
          <span className="text-xs text-panel-muted tracking-wide">
            {bp.compact ? 'Portlar' : 'Dinlenen Portlar'}
          </span>
        </div>
        <span className="text-[11px] font-mono text-panel-muted/60">{data?.ports?.length ?? 0} port</span>
      </div>

      {!bp.compact && (
        <div className="px-3 py-2 border-b border-panel-border shrink-0">
          <div className="flex items-center gap-2 bg-panel-bg border border-panel-border rounded-lg px-2.5 py-1.5">
            <Search size={11} className="text-panel-muted/50 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Port veya servis ara…"
              className="flex-1 bg-transparent text-xs text-panel-text placeholder-panel-muted/40 focus:outline-none"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto divide-y divide-panel-border/30">
        {ports.length === 0 && (
          <div className="flex items-center justify-center py-8 text-panel-muted text-xs">
            {search ? 'Sonuç bulunamadı' : 'Port bulunamadı'}
          </div>
        )}
        {ports.map((p, i) => {
          const known = KNOWN_PORTS[p.localPort];
          const addr  = p.localAddress && p.localAddress !== '0.0.0.0' && p.localAddress !== '::' ? p.localAddress : null;
          return (
            <div key={i} className="flex items-center gap-3 px-3 py-2 hover:bg-panel-hover/40 transition-colors">
              <span className="text-panel-green text-xs font-mono tabular-nums font-semibold w-12 shrink-0">
                {p.localPort}
              </span>
              <span className="text-[10px] text-panel-muted/50 uppercase w-8 shrink-0">{p.protocol}</span>
              <div className="flex-1 min-w-0">
                {known && (
                  <span className="text-[10px] text-panel-accent mr-1.5">{known}</span>
                )}
                {p.process && (
                  <span className="text-xs text-panel-text font-mono truncate">{p.process}</span>
                )}
                {addr && !bp.compact && (
                  <span className="text-[10px] text-panel-muted/50 ml-1.5">{addr}</span>
                )}
              </div>
              {p.pid > 0 && !bp.compact && (
                <span className="text-[10px] text-panel-muted/40 font-mono shrink-0">pid {p.pid}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default WidgetPorts;
