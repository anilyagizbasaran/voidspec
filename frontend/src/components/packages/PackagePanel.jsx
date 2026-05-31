import React, { useState, useCallback } from 'react';
import {
  Package, Search, X, RefreshCw, Download, Trash2, ArrowUpCircle,
  AlertTriangle, Check, ChevronRight, Terminal, Info,
} from 'lucide-react';
import {
  usePackages, useUpgradable, usePackageInfo,
  useAptUpdate, useInstallPackage, useRemovePackage, useUpgradePackage,
} from '../../hooks/usePackages.js';

// ── Output log modal ─────────────────────────────────────────────────────────
function OutputModal({ title, output, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-panel-surface border border-panel-border rounded-lg w-full max-w-2xl h-[70vh] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-panel-border shrink-0">
          <Terminal size={13} className="text-panel-muted" />
          <span className="text-panel-text text-sm font-mono">{title}</span>
          <button onClick={onClose} className="ml-auto text-panel-muted hover:text-panel-text"><X size={14} /></button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <pre className="text-xs font-mono text-panel-text whitespace-pre-wrap leading-relaxed">{output || '(no output)'}</pre>
        </div>
      </div>
    </div>
  );
}

// ── Package info modal ───────────────────────────────────────────────────────
function InfoModal({ name, onClose }) {
  const { data, isLoading } = usePackageInfo(name, true);
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-panel-surface border border-panel-border rounded-lg w-full max-w-xl h-[70vh] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-panel-border shrink-0">
          <Info size={13} className="text-panel-muted" />
          <span className="text-panel-text text-sm font-mono">{name}</span>
          <button onClick={onClose} className="ml-auto text-panel-muted hover:text-panel-text"><X size={14} /></button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-4 bg-panel-hover rounded animate-pulse"/>)}</div>
          ) : (
            <pre className="text-xs font-mono text-panel-muted whitespace-pre-wrap leading-relaxed">{data?.info}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Install modal ────────────────────────────────────────────────────────────
function InstallModal({ onClose, onInstall, loading }) {
  const [name, setName] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-panel-surface border border-panel-border rounded-lg w-full max-w-sm p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Download size={14} className="text-panel-muted" />
          <h3 className="text-panel-text text-sm font-medium">Install Package</h3>
          <button onClick={onClose} className="ml-auto text-panel-muted hover:text-panel-text"><X size={14} /></button>
        </div>
        <input
          value={name} onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9.+\-]/g, ''))}
          onKeyDown={e => e.key === 'Enter' && name && onInstall(name)}
          placeholder="nginx, curl, htop…"
          autoFocus
          className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text placeholder-panel-muted focus:outline-none focus:border-panel-accent font-mono"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-panel-muted hover:text-panel-text rounded hover:bg-panel-hover">Cancel</button>
          <button disabled={!name || loading} onClick={() => onInstall(name)}
            className="px-3 py-1.5 text-xs bg-panel-green/20 text-panel-green rounded hover:bg-panel-green/30 disabled:opacity-40 flex items-center gap-1.5">
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />} Install
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Remove confirm ───────────────────────────────────────────────────────────
function RemoveConfirm({ pkg, onClose, onRemove, loading }) {
  const [purge, setPurge] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-panel-surface border border-panel-border rounded-lg w-full max-w-sm p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-panel-yellow" />
          <h3 className="text-panel-text text-sm font-medium">Remove <span className="font-mono">{pkg.name}</span>?</h3>
          <button onClick={onClose} className="ml-auto text-panel-muted hover:text-panel-text"><X size={14} /></button>
        </div>
        <p className="text-panel-muted text-xs">{pkg.description}</p>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={purge} onChange={e => setPurge(e.target.checked)} className="w-3.5 h-3.5" />
          <span className="text-xs text-panel-text">Purge (also remove config files)</span>
        </label>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-panel-muted hover:text-panel-text rounded hover:bg-panel-hover">Cancel</button>
          <button disabled={loading} onClick={() => onRemove(purge)}
            className="px-3 py-1.5 text-xs bg-panel-red/20 text-panel-red rounded hover:bg-panel-red/30 disabled:opacity-40 flex items-center gap-1.5">
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {purge ? 'Purge' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upgrade all confirm ──────────────────────────────────────────────────────
function UpgradeAllConfirm({ count, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-panel-surface border border-panel-border rounded-lg w-full max-w-sm p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <ArrowUpCircle size={14} className="text-panel-cyan" />
          <h3 className="text-panel-text text-sm font-medium">Upgrade All Packages?</h3>
        </div>
        <p className="text-panel-muted text-xs">{count} package{count !== 1 ? 's' : ''} will be upgraded. This may take a while.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-panel-muted hover:text-panel-text rounded hover:bg-panel-hover">Cancel</button>
          <button disabled={loading} onClick={onConfirm}
            className="px-3 py-1.5 text-xs bg-panel-cyan/20 text-panel-cyan rounded hover:bg-panel-cyan/30 disabled:opacity-40 flex items-center gap-1.5">
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <ArrowUpCircle size={12} />} Upgrade All
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'installed', label: 'Installed' },
  { id: 'upgradable', label: 'Updates' },
];

export default function PackagePanel() {
  const [tab,           setTab]          = useState('installed');
  const [search,        setSearch]       = useState('');
  const [offset,        setOffset]       = useState(0);
  const [installOpen,   setInstallOpen]  = useState(false);
  const [removeTarget,  setRemoveTarget] = useState(null);
  const [infoTarget,    setInfoTarget]   = useState(null);
  const [outputModal,   setOutputModal]  = useState(null);
  const [upgradeAllOpen,setUpgradeAllOpen] = useState(false);
  const [toast,         setToast]        = useState(null);

  const { data: pkgData, isLoading: pkgLoading, refetch: refetchPkgs } = usePackages(search, offset);
  const { data: upgData, isLoading: upgLoading, refetch: refetchUpg }  = useUpgradable();

  const updateMut  = useAptUpdate();
  const installMut = useInstallPackage();
  const removeMut  = useRemovePackage();
  const upgradeMut = useUpgradePackage();

  function showToast(ok, msg) { setToast({ ok, msg }); setTimeout(() => setToast(null), 4000); }

  const handleSearch = useCallback(v => { setSearch(v); setOffset(0); }, []);

  async function handleAptUpdate() {
    try {
      const r = await updateMut.mutateAsync();
      refetchUpg();
      showToast(true, 'Package index updated');
      setOutputModal({ title: 'apt update', output: r.output });
    } catch (e) { showToast(false, e.response?.data?.error || 'Update failed'); }
  }

  async function handleInstall(name) {
    setInstallOpen(false);
    try {
      const r = await installMut.mutateAsync(name);
      showToast(true, `${name} installed`);
      setOutputModal({ title: `apt install ${name}`, output: r.output });
    } catch (e) {
      showToast(false, e.response?.data?.error || 'Install failed');
      if (e.response?.data?.output) setOutputModal({ title: `Install failed: ${name}`, output: e.response.data.output });
    }
  }

  async function handleRemove(purge) {
    const pkg = removeTarget;
    setRemoveTarget(null);
    try {
      const r = await removeMut.mutateAsync({ name: pkg.name, purge });
      showToast(true, `${pkg.name} removed`);
      setOutputModal({ title: `apt remove ${pkg.name}`, output: r.output });
    } catch (e) {
      showToast(false, e.response?.data?.error || 'Remove failed');
      if (e.response?.data?.output) setOutputModal({ title: `Remove failed: ${pkg.name}`, output: e.response.data.output });
    }
  }

  async function handleUpgrade(name) {
    try {
      const r = await upgradeMut.mutateAsync(name || null);
      showToast(true, name ? `${name} upgraded` : 'System upgraded');
      setOutputModal({ title: name ? `Upgrade: ${name}` : 'System upgrade', output: r.output });
      setUpgradeAllOpen(false);
      refetchUpg();
    } catch (e) {
      showToast(false, e.response?.data?.error || 'Upgrade failed');
      if (e.response?.data?.output) setOutputModal({ title: 'Upgrade failed', output: e.response.data.output });
    }
  }

  const upgradable = upgData?.packages || [];
  const packages   = pkgData?.packages || [];
  const total      = pkgData?.total    || 0;
  const isBusy     = installMut.isPending || removeMut.isPending || upgradeMut.isPending;

  return (
    <div className="p-4 h-full flex flex-col gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-panel-text font-medium flex items-center gap-2">
          <Package size={15} className="text-panel-muted" />
          Packages
        </h2>

        {/* apt update */}
        <button onClick={handleAptUpdate} disabled={updateMut.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-panel-border text-panel-muted rounded hover:text-panel-text hover:border-panel-text disabled:opacity-40 transition-colors">
          {updateMut.isPending ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          apt update
        </button>

        {/* Install */}
        <button onClick={() => setInstallOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-panel-green/20 text-panel-green rounded hover:bg-panel-green/30">
          <Download size={12} /> Install
        </button>

        {/* Upgrade all */}
        {upgradable.length > 0 && (
          <button onClick={() => setUpgradeAllOpen(true)} disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-panel-cyan/20 text-panel-cyan rounded hover:bg-panel-cyan/30 disabled:opacity-40">
            <ArrowUpCircle size={12} /> Upgrade All ({upgradable.length})
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-panel-border pb-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              tab === t.id ? 'bg-panel-accent/20 text-panel-accent' : 'text-panel-muted hover:text-panel-text hover:bg-panel-hover'
            }`}>
            {t.label}
            {t.id === 'upgradable' && upgradable.length > 0 && (
              <span className="ml-1.5 text-panel-cyan font-semibold">{upgradable.length}</span>
            )}
          </button>
        ))}

        {tab === 'installed' && (
          <div className="relative ml-auto">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-panel-muted" />
            <input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Search packages…"
              className="bg-panel-surface border border-panel-border rounded pl-7 pr-7 py-1 text-xs text-panel-text placeholder-panel-muted focus:outline-none focus:border-panel-accent w-48 font-mono" />
            {search && (
              <button onClick={() => handleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-panel-muted hover:text-panel-text">
                <X size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Upgradable tab ── */}
      {tab === 'upgradable' && (
        <div className="bg-panel-surface border border-panel-border rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-panel-muted border-b border-panel-border">
              <tr>
                <th className="text-left pl-4 py-2 font-normal">Package</th>
                <th className="text-left py-2 font-normal hidden sm:table-cell">Current</th>
                <th className="text-left py-2 font-normal">New version</th>
                <th className="text-right pr-4 py-2 font-normal w-20">Upgrade</th>
              </tr>
            </thead>
            <tbody>
              {upgLoading ? (
                Array.from({length:5}).map((_,i)=>(
                  <tr key={i} className="border-b border-panel-border/30">
                    <td colSpan={4} className="py-2 pl-4"><div className="h-4 bg-panel-hover rounded animate-pulse"/></td>
                  </tr>
                ))
              ) : upgradable.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-panel-muted">
                    <Check size={20} className="text-panel-green" />
                    <span>All packages up to date</span>
                  </div>
                </td></tr>
              ) : (
                upgradable.map(pkg => (
                  <tr key={pkg.name} className="border-b border-panel-border/30 last:border-0 hover:bg-panel-hover/20">
                    <td className="pl-4 py-2 font-mono text-panel-text">{pkg.name}</td>
                    <td className="py-2 font-mono text-panel-muted hidden sm:table-cell">{pkg.oldVersion}</td>
                    <td className="py-2 font-mono text-panel-cyan">{pkg.newVersion}</td>
                    <td className="py-2 pr-4 text-right">
                      <button onClick={() => handleUpgrade(pkg.name)} disabled={isBusy}
                        className="p-1.5 text-panel-muted hover:text-panel-cyan disabled:opacity-40 transition-colors" title="Upgrade">
                        {upgradeMut.isPending ? <RefreshCw size={13} className="animate-spin" /> : <ArrowUpCircle size={13} />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Installed tab ── */}
      {tab === 'installed' && (
        <>
          <div className="bg-panel-surface border border-panel-border rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-panel-muted border-b border-panel-border">
                <tr>
                  <th className="text-left pl-4 py-2 font-normal">Package</th>
                  <th className="text-left py-2 font-normal w-32 hidden sm:table-cell">Version</th>
                  <th className="text-left py-2 font-normal hidden md:table-cell">Description</th>
                  <th className="text-right pr-4 py-2 font-normal w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pkgLoading ? (
                  Array.from({length:10}).map((_,i)=>(
                    <tr key={i} className="border-b border-panel-border/30">
                      <td colSpan={4} className="py-2 pl-4"><div className="h-4 bg-panel-hover rounded animate-pulse"/></td>
                    </tr>
                  ))
                ) : packages.length === 0 ? (
                  <tr><td colSpan={4} className="py-10 text-center text-panel-muted">No packages found</td></tr>
                ) : (
                  packages.map(pkg => (
                    <tr key={pkg.name} className="border-b border-panel-border/30 last:border-0 hover:bg-panel-hover/20">
                      <td className="pl-4 py-1.5 font-mono text-panel-text">{pkg.name}</td>
                      <td className="py-1.5 font-mono text-panel-muted hidden sm:table-cell truncate max-w-[8rem]">{pkg.version}</td>
                      <td className="py-1.5 text-panel-muted hidden md:table-cell truncate max-w-xs" title={pkg.description}>{pkg.description}</td>
                      <td className="py-1.5 pr-4">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => setInfoTarget(pkg.name)}
                            title="Info" className="p-1.5 text-panel-muted hover:text-panel-accent transition-colors">
                            <Info size={12} />
                          </button>
                          <button onClick={() => setRemoveTarget(pkg)}
                            title="Remove" className="p-1.5 text-panel-muted hover:text-panel-red transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 100 && (
            <div className="flex items-center justify-between text-xs text-panel-muted">
              <span>{offset + 1}–{Math.min(offset + 100, total)} of {total}</span>
              <div className="flex gap-2">
                <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}
                  className="px-3 py-1 rounded border border-panel-border hover:border-panel-text disabled:opacity-40">← Prev</button>
                <button disabled={offset + 100 >= total} onClick={() => setOffset(offset + 100)}
                  className="px-3 py-1 rounded border border-panel-border hover:border-panel-text disabled:opacity-40">Next →</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {installOpen    && <InstallModal onClose={() => setInstallOpen(false)} onInstall={handleInstall} loading={installMut.isPending} />}
      {removeTarget   && <RemoveConfirm pkg={removeTarget} onClose={() => setRemoveTarget(null)} onRemove={handleRemove} loading={removeMut.isPending} />}
      {infoTarget     && <InfoModal name={infoTarget} onClose={() => setInfoTarget(null)} />}
      {outputModal    && <OutputModal title={outputModal.title} output={outputModal.output} onClose={() => setOutputModal(null)} />}
      {upgradeAllOpen && <UpgradeAllConfirm count={upgradable.length} onClose={() => setUpgradeAllOpen(false)} onConfirm={() => handleUpgrade(null)} loading={upgradeMut.isPending} />}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-4 right-4 px-4 py-2.5 rounded-lg border text-xs font-mono z-50 shadow-lg ${
          toast.ok ? 'bg-panel-green/10 border-panel-green text-panel-green'
                   : 'bg-panel-red/10 border-panel-red text-panel-red'
        }`}>{toast.msg}</div>
      )}
    </div>
  );
}
