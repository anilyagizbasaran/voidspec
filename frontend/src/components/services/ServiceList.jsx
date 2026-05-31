import React, { useState, useMemo } from 'react';
import { Server, Search, X, RefreshCw, Play, Square, RotateCcw, FileText, ChevronDown, ChevronRight, Power } from 'lucide-react';
import { useServices, useServiceAction, useServiceLogs, useServiceStatus } from '../../hooks/useServices.js';

const ACTIVE_COLOR = {
  active: 'text-panel-green',
  inactive: 'text-panel-muted',
  failed: 'text-panel-red',
  activating: 'text-panel-yellow',
  deactivating: 'text-panel-yellow',
  reloading: 'text-panel-yellow',
};

const SUB_DOT = {
  running: 'bg-panel-green',
  exited: 'bg-panel-muted',
  failed: 'bg-panel-red',
  dead: 'bg-panel-muted',
  waiting: 'bg-panel-yellow',
  start: 'bg-panel-yellow',
  stop: 'bg-panel-yellow',
};

const ENABLED_COLOR = {
  enabled: 'text-panel-green',
  disabled: 'text-panel-muted',
  masked: 'text-panel-red',
  static: 'text-panel-muted',
  'enabled-runtime': 'text-panel-yellow',
};

function LogViewer({ name, onClose }) {
  const { data, isLoading } = useServiceLogs(name, true);
  const { data: statusData } = useServiceStatus(name, true);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-panel-surface border border-panel-border rounded-xl w-full max-w-3xl h-[80vh] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-panel-border shrink-0">
          <FileText size={13} className="text-panel-muted" />
          <span className="text-panel-text text-sm font-mono">{name}</span>
          <button onClick={onClose} className="ml-auto text-panel-muted hover:text-panel-text">
            <X size={15} />
          </button>
        </div>

        {statusData?.status && (
          <div className="px-4 py-2 border-b border-panel-border shrink-0 bg-panel-bg">
            <pre className="text-xs font-mono text-panel-muted whitespace-pre-wrap leading-relaxed line-clamp-4">
              {statusData.status}
            </pre>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-4 bg-panel-hover rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <pre className="text-xs font-mono text-panel-text whitespace-pre-wrap leading-relaxed">
              {data?.logs || '(no log output)'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, variant = 'default', disabled }) {
  const colors = {
    default: 'text-panel-muted hover:text-panel-text hover:bg-panel-hover',
    green: 'text-panel-muted hover:text-panel-green hover:bg-panel-green/10',
    red: 'text-panel-muted hover:text-panel-red hover:bg-panel-red/10',
    yellow: 'text-panel-muted hover:text-panel-yellow hover:bg-panel-yellow/10',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-1.5 rounded transition-colors disabled:opacity-30 ${colors[variant]}`}
    >
      <Icon size={13} />
    </button>
  );
}

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'failed', label: 'Failed' },
  { id: 'inactive', label: 'Inactive' },
];

export default function ServiceList() {
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('running');
  const [logTarget, setLogTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [pending, setPending] = useState(null);

  const { data, isLoading, refetch, isFetching } = useServices();
  const actionMutation = useServiceAction();

  async function doAction(name, action) {
    setPending(`${name}:${action}`);
    try {
      await actionMutation.mutateAsync({ name, action });
      showToast(true, `${action} → ${name}`);
    } catch (e) {
      showToast(false, e.response?.data?.error || `Failed: ${action}`);
    } finally {
      setPending(null);
    }
  }

  function showToast(ok, msg) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  const filtered = useMemo(() => {
    let list = data?.services || [];

    if (filterTab === 'running') list = list.filter(s => s.sub === 'running');
    else if (filterTab === 'failed') list = list.filter(s => s.active === 'failed' || s.sub === 'failed');
    else if (filterTab === 'inactive') list = list.filter(s => s.active === 'inactive' || s.sub === 'dead');

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.unit.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [data, filterTab, search]);

  const counts = useMemo(() => {
    const all = data?.services || [];
    return {
      all: all.length,
      running: all.filter(s => s.sub === 'running').length,
      failed: all.filter(s => s.active === 'failed' || s.sub === 'failed').length,
      inactive: all.filter(s => s.active === 'inactive' || s.sub === 'dead').length,
    };
  }, [data]);

  return (
    <div className="p-4 h-full flex flex-col gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-panel-text font-medium flex items-center gap-2">
          <Server size={15} className="text-panel-muted" />
          Services
        </h2>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto p-1.5 text-panel-muted hover:text-panel-text disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-panel-border pb-2">
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
              tab.id === 'failed' && counts.failed > 0 ? 'text-panel-red font-bold' :
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
            placeholder="Search…"
            className="bg-panel-surface border border-panel-border rounded pl-7 pr-7 py-1 text-xs text-panel-text placeholder-panel-muted focus:outline-none focus:border-panel-accent w-44 font-mono"
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
              <th className="text-left pl-4 py-2 font-normal w-6"></th>
              <th className="text-left py-2 font-normal">Service</th>
              <th className="text-left py-2 font-normal w-20 hidden sm:table-cell">State</th>
              <th className="text-left py-2 font-normal w-20 hidden md:table-cell">Enabled</th>
              <th className="text-left py-2 font-normal hidden lg:table-cell">Description</th>
              <th className="text-right pr-4 py-2 font-normal w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 12 }).map((_, i) => (
                <tr key={i} className="border-b border-panel-border/30">
                  <td colSpan={6} className="py-2 pl-4">
                    <div className="h-4 bg-panel-hover rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-panel-muted">
                  {search ? 'No matching services' : 'No services in this category'}
                </td>
              </tr>
            ) : (
              filtered.map(svc => {
                const isPending = pending?.startsWith(svc.unit);
                const isRunning = svc.sub === 'running';
                const isFailed = svc.active === 'failed' || svc.sub === 'failed';

                return (
                  <tr
                    key={svc.unit}
                    className={`border-b border-panel-border/30 last:border-0 hover:bg-panel-hover/20 ${isFailed ? 'bg-panel-red/5' : ''}`}
                  >
                    {/* Status dot */}
                    <td className="pl-4 py-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${SUB_DOT[svc.sub] || 'bg-panel-muted'} ${isRunning ? 'shadow-[0_0_4px_currentColor]' : ''}`} />
                    </td>

                    {/* Name */}
                    <td className="py-2 pr-2">
                      <span className="font-mono text-panel-text">
                        {svc.unit.replace('.service', '')}
                      </span>
                    </td>

                    {/* Active state */}
                    <td className={`py-2 font-mono hidden sm:table-cell ${ACTIVE_COLOR[svc.active] || 'text-panel-muted'}`}>
                      {svc.sub}
                    </td>

                    {/* Enabled */}
                    <td className={`py-2 font-mono hidden md:table-cell text-xs ${ENABLED_COLOR[svc.enabled] || 'text-panel-muted'}`}>
                      {svc.enabled}
                    </td>

                    {/* Description */}
                    <td className="py-2 text-panel-muted hidden lg:table-cell max-w-xs truncate" title={svc.description}>
                      {svc.description}
                    </td>

                    {/* Actions */}
                    <td className="py-2 pr-4">
                      <div className="flex items-center justify-end gap-0.5">
                        {isPending ? (
                          <RefreshCw size={13} className="animate-spin text-panel-accent mr-1" />
                        ) : (
                          <>
                            {!isRunning ? (
                              <ActionButton icon={Play} label="Start" variant="green" disabled={isPending} onClick={() => doAction(svc.unit, 'start')} />
                            ) : (
                              <ActionButton icon={Square} label="Stop" variant="red" disabled={isPending} onClick={() => doAction(svc.unit, 'stop')} />
                            )}
                            <ActionButton icon={RotateCcw} label="Restart" variant="yellow" disabled={isPending} onClick={() => doAction(svc.unit, 'restart')} />
                            <ActionButton
                              icon={Power}
                              label={svc.enabled === 'enabled' ? 'Disable' : 'Enable'}
                              variant={svc.enabled === 'enabled' ? 'red' : 'green'}
                              disabled={isPending || svc.enabled === 'static' || svc.enabled === 'masked'}
                              onClick={() => doAction(svc.unit, svc.enabled === 'enabled' ? 'disable' : 'enable')}
                            />
                            <ActionButton icon={FileText} label="Logs" onClick={() => setLogTarget(svc.unit)} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Log viewer modal */}
      {logTarget && <LogViewer name={logTarget} onClose={() => setLogTarget(null)} />}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-4 right-4 px-4 py-2.5 rounded-lg border text-xs font-mono z-50 shadow-lg ${
          toast.ok
            ? 'bg-panel-green/10 border-panel-green text-panel-green'
            : 'bg-panel-red/10 border-panel-red text-panel-red'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
