import React, { useState, useMemo } from 'react';
import { History, RefreshCw, Search, X, CheckCircle2, XCircle, Lock, MapPin, Globe } from 'lucide-react';
import { useLoginHistory } from '../../hooks/useLoginHistory.js';

const RESULT_META = {
  success: { label: 'Başarılı', icon: CheckCircle2, color: 'text-panel-green', dot: 'bg-panel-green' },
  fail:    { label: 'Başarısız', icon: XCircle, color: 'text-panel-red', dot: 'bg-panel-red' },
  locked:  { label: 'Kilitli', icon: Lock, color: 'text-panel-yellow', dot: 'bg-panel-yellow' },
};

const FILTER_TABS = [
  { id: 'all', label: 'Tümü' },
  { id: 'success', label: 'Başarılı' },
  { id: 'fail', label: 'Başarısız' },
  { id: 'locked', label: 'Kilitli' },
];

function locationText(loc) {
  if (!loc || loc.note) return loc?.note === 'private/local' ? 'Yerel ağ' : '—';
  const parts = [loc.city, loc.region, loc.country].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

export default function LoginHistory() {
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const { data, isLoading, refetch, isFetching } = useLoginHistory();

  const events = data?.events || [];

  const counts = useMemo(() => ({
    all: events.length,
    success: events.filter(e => e.result === 'success').length,
    fail: events.filter(e => e.result === 'fail').length,
    locked: events.filter(e => e.result === 'locked').length,
  }), [events]);

  const filtered = useMemo(() => {
    let list = events;
    if (filterTab !== 'all') list = list.filter(e => e.result === filterTab);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        (e.ip || '').toLowerCase().includes(q) ||
        (e.username || '').toLowerCase().includes(q) ||
        locationText(e.location).toLowerCase().includes(q) ||
        (e.userAgent || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, filterTab, search]);

  return (
    <div className="p-4 h-full flex flex-col gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-panel-text font-medium flex items-center gap-2">
          <History size={15} className="text-panel-muted" />
          Giriş Geçmişi
        </h2>
        {counts.fail > 0 && (
          <span className="text-xs text-panel-red font-mono">
            {counts.fail} başarısız deneme
          </span>
        )}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto p-1.5 text-panel-muted hover:text-panel-text disabled:opacity-40"
          title="Yenile"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filter tabs + search */}
      <div className="flex items-center gap-1 border-b border-panel-border pb-2 flex-wrap">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              filterTab === tab.id
                ? 'bg-panel-accent/20 text-panel-accent'
                : 'text-panel-muted hover:text-panel-text hover:bg-panel-hover'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs ${
              tab.id === 'fail' && counts.fail > 0 ? 'text-panel-red font-bold' :
              filterTab === tab.id ? 'text-panel-accent' : 'text-panel-muted'
            }`}>
              {counts[tab.id]}
            </span>
          </button>
        ))}

        <div className="relative ml-auto">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-panel-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="IP, konum, kullanıcı…"
            className="bg-panel-surface border border-panel-border rounded pl-7 pr-7 py-1 text-xs text-panel-text placeholder-panel-muted focus:outline-none focus:border-panel-accent w-52 font-mono"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-panel-muted hover:text-panel-text">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-panel-surface border border-panel-border rounded-xl overflow-x-auto flex-1">
        <table className="w-full text-xs">
          <thead className="text-panel-muted border-b border-panel-border bg-panel-surface sticky top-0">
            <tr>
              <th className="text-left pl-4 py-2 font-normal w-24">Sonuç</th>
              <th className="text-left py-2 font-normal w-40">Tarih / Saat</th>
              <th className="text-left py-2 font-normal w-32">IP</th>
              <th className="text-left py-2 font-normal">Konum</th>
              <th className="text-left py-2 font-normal hidden lg:table-cell">ISP</th>
              <th className="text-left py-2 font-normal w-24">Kullanıcı</th>
              <th className="text-left pr-4 py-2 font-normal hidden xl:table-cell">Tarayıcı</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 12 }).map((_, i) => (
                <tr key={i} className="border-b border-panel-border/30">
                  <td colSpan={7} className="py-2 pl-4">
                    <div className="h-4 bg-panel-hover rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-panel-muted">
                  {search ? 'Eşleşen kayıt yok' : 'Henüz giriş kaydı yok'}
                </td>
              </tr>
            ) : (
              filtered.map((e, i) => {
                const meta = RESULT_META[e.result] || RESULT_META.fail;
                const Icon = meta.icon;
                const loc = e.location || {};
                return (
                  <tr
                    key={i}
                    className={`border-b border-panel-border/30 last:border-0 hover:bg-panel-hover/20 ${e.result === 'fail' ? 'bg-panel-red/5' : ''}`}
                  >
                    <td className="pl-4 py-2">
                      <span className={`inline-flex items-center gap-1.5 ${meta.color}`}>
                        <Icon size={13} />
                        <span className="hidden sm:inline">{meta.label}</span>
                      </span>
                    </td>
                    <td className="py-2 font-mono text-panel-text">{e.localTime || '—'}</td>
                    <td className="py-2 font-mono text-panel-text">{e.ip || '—'}</td>
                    <td className="py-2 text-panel-muted">
                      <span className="inline-flex items-center gap-1">
                        {loc.note === 'private/local'
                          ? <Globe size={11} className="text-panel-muted shrink-0" />
                          : (loc.country ? <MapPin size={11} className="text-panel-cyan shrink-0" /> : null)}
                        {locationText(loc)}
                      </span>
                    </td>
                    <td className="py-2 text-panel-muted hidden lg:table-cell max-w-[16rem] truncate" title={loc.isp || ''}>
                      {loc.isp || '—'}
                    </td>
                    <td className="py-2 font-mono text-panel-muted">{e.username || '—'}</td>
                    <td className="py-2 pr-4 text-panel-muted hidden xl:table-cell max-w-xs truncate" title={e.userAgent || ''}>
                      {e.userAgent || '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
