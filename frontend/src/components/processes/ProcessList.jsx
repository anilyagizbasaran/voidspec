import React, { useState, useMemo } from 'react';
import { Activity, Search, AlertTriangle, X, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { useProcesses, useKillProcess } from '../../hooks/useProcesses.js';

function formatMem(kb) {
  if (!kb) return '—';
  if (kb < 1024) return `${kb} KB`;
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${(kb / 1024 / 1024).toFixed(2)} GB`;
}

const STATE_COLOR = {
  R: 'text-panel-green',
  S: 'text-panel-muted',
  D: 'text-panel-red',
  Z: 'text-panel-yellow',
  T: 'text-panel-yellow',
  I: 'text-panel-muted',
};

const STATE_LABEL = { R: 'Running', S: 'Sleep', D: 'Disk wait', Z: 'Zombie', T: 'Stopped', I: 'Idle' };

function SortIcon({ col, sortBy, sortDir }) {
  if (sortBy !== col) return <ChevronUp size={11} className="opacity-20" />;
  return sortDir === 'asc' ? <ChevronUp size={11} className="text-panel-accent" /> : <ChevronDown size={11} className="text-panel-accent" />;
}

function KillModal({ proc, onClose, onKill, loading }) {
  const [signal, setSignal] = useState('SIGTERM');
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-panel-surface border border-panel-border rounded-xl p-5 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} className="text-panel-yellow" />
          <h3 className="text-panel-text text-sm font-medium">Send Signal</h3>
          <button onClick={onClose} className="ml-auto text-panel-muted hover:text-panel-text">
            <X size={14} />
          </button>
        </div>
        <p className="text-panel-muted text-xs mb-4">
          Process: <span className="text-panel-text font-mono">{proc.name}</span>
          {' '}(PID <span className="text-panel-text font-mono">{proc.pid}</span>)
        </p>
        <div className="flex gap-2 mb-4">
          {['SIGTERM', 'SIGKILL', 'SIGHUP', 'SIGSTOP'].map(s => (
            <button
              key={s}
              onClick={() => setSignal(s)}
              className={`px-2.5 py-1.5 text-xs rounded font-mono border transition-colors ${
                signal === s
                  ? s === 'SIGKILL' ? 'bg-panel-red/20 border-panel-red text-panel-red' : 'bg-panel-accent/20 border-panel-accent text-panel-accent'
                  : 'border-panel-border text-panel-muted hover:text-panel-text hover:border-panel-hover'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="text-xs text-panel-muted mb-4">
          {signal === 'SIGTERM' && 'Graceful shutdown — allows process to clean up.'}
          {signal === 'SIGKILL' && 'Force kill — process cannot intercept or ignore this.'}
          {signal === 'SIGHUP' && 'Hangup — often triggers config reload.'}
          {signal === 'SIGSTOP' && 'Pause execution — resume with SIGCONT.'}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-panel-muted hover:text-panel-text rounded hover:bg-panel-hover">
            Cancel
          </button>
          <button
            onClick={() => onKill(signal)}
            disabled={loading}
            className={`px-3 py-1.5 text-xs rounded disabled:opacity-40 transition-colors ${
              signal === 'SIGKILL'
                ? 'bg-panel-red/20 text-panel-red hover:bg-panel-red/30'
                : 'bg-panel-accent/20 text-panel-accent hover:bg-panel-accent/30'
            }`}
          >
            {loading ? 'Sending…' : `Send ${signal}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProcessList() {
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('cpu');
  const [sortDir, setSortDir] = useState('desc');
  const [showAll, setShowAll] = useState(false);
  const [killTarget, setKillTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const { data, isLoading, refetch, isFetching } = useProcesses();
  const killMutation = useKillProcess();

  function handleSort(col) {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  }

  const filtered = useMemo(() => {
    let list = data?.list || [];
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        String(p.pid).includes(q) ||
        p.user?.toLowerCase().includes(q) ||
        p.command?.toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return showAll ? list : list.slice(0, 50);
  }, [data, filter, sortBy, sortDir, showAll]);

  async function handleKill(signal) {
    try {
      await killMutation.mutateAsync({ pid: killTarget.pid, signal });
      setToast({ ok: true, msg: `${signal} sent to PID ${killTarget.pid}` });
    } catch (e) {
      setToast({ ok: false, msg: e.response?.data?.error || 'Failed' });
    } finally {
      setKillTarget(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  const ColHeader = ({ col, label, className = '' }) => (
    <th
      className={`text-left pb-2 font-normal cursor-pointer select-none hover:text-panel-text transition-colors ${className}`}
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        <SortIcon col={col} sortBy={sortBy} sortDir={sortDir} />
      </div>
    </th>
  );

  return (
    <div className="p-4 h-full overflow-auto flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-panel-text font-medium flex items-center gap-2">
          <Activity size={15} className="text-panel-muted" />
          Processes
        </h2>
        {data && (
          <div className="flex gap-3 text-xs text-panel-muted">
            <span>Total: <span className="text-panel-text">{data.total}</span></span>
            <span className="text-panel-green">Running: {data.running}</span>
            <span>Sleeping: {data.sleeping}</span>
            {data.blocked > 0 && <span className="text-panel-red">Blocked: {data.blocked}</span>}
          </div>
        )}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto p-1.5 text-panel-muted hover:text-panel-text disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-panel-muted" />
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by name, PID, user, command…"
          className="w-full bg-panel-surface border border-panel-border rounded px-3 py-2 pl-8 text-xs text-panel-text placeholder-panel-muted focus:outline-none focus:border-panel-accent font-mono"
        />
        {filter && (
          <button onClick={() => setFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-panel-muted hover:text-panel-text">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-panel-surface border border-panel-border rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-panel-muted border-b border-panel-border sticky top-0 bg-panel-surface">
            <tr>
              <ColHeader col="pid" label="PID" className="pl-4 w-16" />
              <ColHeader col="name" label="Name" className="w-32" />
              <ColHeader col="cpu" label="CPU%" className="w-16" />
              <ColHeader col="mem" label="MEM%" className="w-16" />
              <ColHeader col="memRss" label="RSS" className="hidden md:table-cell w-20" />
              <ColHeader col="user" label="User" className="hidden sm:table-cell w-24" />
              <th className="text-left pb-2 font-normal w-8 hidden lg:table-cell">State</th>
              <th className="text-left pb-2 font-normal hidden xl:table-cell">Command</th>
              <th className="text-right pb-2 font-normal pr-4 w-16">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-panel-border/30">
                  <td colSpan={9} className="py-2 pl-4"><div className="h-4 bg-panel-hover rounded animate-pulse" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-panel-muted">No processes found</td>
              </tr>
            ) : (
              filtered.map(p => (
                <tr key={p.pid} className="border-b border-panel-border/30 last:border-0 hover:bg-panel-hover/20">
                  <td className="py-1.5 pl-4 font-mono text-panel-muted">{p.pid}</td>
                  <td className="py-1.5 font-mono text-panel-text max-w-[8rem] truncate" title={p.name}>{p.name}</td>
                  <td className={`py-1.5 font-mono font-semibold ${p.cpu > 50 ? 'text-panel-red' : p.cpu > 20 ? 'text-panel-yellow' : p.cpu > 0 ? 'text-panel-green' : 'text-panel-muted'}`}>
                    {p.cpu > 0 ? `${p.cpu}%` : '—'}
                  </td>
                  <td className={`py-1.5 font-mono ${p.mem > 20 ? 'text-panel-red' : p.mem > 5 ? 'text-panel-yellow' : 'text-panel-muted'}`}>
                    {p.mem > 0 ? `${p.mem}%` : '—'}
                  </td>
                  <td className="py-1.5 font-mono text-panel-muted hidden md:table-cell">{formatMem(p.memRss)}</td>
                  <td className="py-1.5 font-mono text-panel-muted hidden sm:table-cell max-w-[6rem] truncate" title={p.user}>{p.user || '—'}</td>
                  <td className={`py-1.5 font-mono hidden lg:table-cell ${STATE_COLOR[p.state] || 'text-panel-muted'}`} title={STATE_LABEL[p.state]}>
                    {p.state || '—'}
                  </td>
                  <td className="py-1.5 font-mono text-panel-muted hidden xl:table-cell max-w-xs truncate" title={p.command}>
                    {p.command}
                  </td>
                  <td className="py-1.5 pr-4 text-right">
                    <button
                      onClick={() => setKillTarget(p)}
                      className="px-2 py-0.5 text-xs rounded border border-panel-border text-panel-muted hover:text-panel-red hover:border-panel-red transition-colors"
                    >
                      Kill
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Show more */}
      {!showAll && data && data.list?.length > 50 && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-panel-muted hover:text-panel-text py-2 text-center"
        >
          Showing 50 of {data.list.length} — show all
        </button>
      )}

      {/* Kill modal */}
      {killTarget && (
        <KillModal
          proc={killTarget}
          onClose={() => setKillTarget(null)}
          onKill={handleKill}
          loading={killMutation.isPending}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-4 right-4 px-4 py-2.5 rounded-lg border text-xs font-mono z-50 ${
          toast.ok ? 'bg-panel-green/10 border-panel-green text-panel-green' : 'bg-panel-red/10 border-panel-red text-panel-red'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
