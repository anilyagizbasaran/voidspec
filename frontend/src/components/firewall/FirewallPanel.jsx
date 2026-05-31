import React, { useState } from 'react';
import {
  Shield, ShieldOff, ShieldAlert, Plus, Trash2, RefreshCw,
  X, Check, AlertTriangle, Info, ChevronDown, ChevronRight,
} from 'lucide-react';
import {
  useFirewallStatus, useFirewallEnable, useFirewallDisable,
  useAddRule, useDeleteRule, useResetFirewall,
} from '../../hooks/useFirewall.js';

// ── colours ─────────────────────────────────────────────────────────────────
const ACTION_COLOR = {
  ALLOW:  'text-panel-green  bg-panel-green/10  border-panel-green/30',
  DENY:   'text-panel-red    bg-panel-red/10    border-panel-red/30',
  REJECT: 'text-panel-red    bg-panel-red/10    border-panel-red/30',
  LIMIT:  'text-panel-yellow bg-panel-yellow/10 border-panel-yellow/30',
};

// ── Add-rule modal ───────────────────────────────────────────────────────────
const COMMON_PORTS = [
  { label: 'SSH (22)',    port: '22',   proto: 'tcp' },
  { label: 'HTTP (80)',   port: '80',   proto: 'tcp' },
  { label: 'HTTPS (443)', port: '443',  proto: 'tcp' },
  { label: 'MySQL (3306)',port: '3306', proto: 'tcp' },
  { label: 'Postgres (5432)', port: '5432', proto: 'tcp' },
  { label: 'Redis (6379)',port: '6379', proto: 'tcp' },
];

function AddRuleModal({ sshPort, onClose, onAdd, loading }) {
  const [action,    setAction]    = useState('allow');
  const [direction, setDirection] = useState('in');
  const [proto,     setProto]     = useState('tcp');
  const [port,      setPort]      = useState('');
  const [from,      setFrom]      = useState('');
  const [comment,   setComment]   = useState('');

  const isSshBlock = (action === 'deny' || action === 'reject') &&
    port === String(sshPort);

  function applyPreset(p) {
    setPort(p.port);
    setProto(p.proto);
  }

  const valid = port.trim() || from.trim();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-panel-surface border border-panel-border rounded-xl w-full max-w-lg p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-panel-muted" />
          <h3 className="text-panel-text text-sm font-medium">Add Firewall Rule</h3>
          <button onClick={onClose} className="ml-auto text-panel-muted hover:text-panel-text"><X size={14} /></button>
        </div>

        {/* Quick ports */}
        <div>
          <p className="text-panel-muted text-xs mb-2">Quick presets</p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_PORTS.map(p => (
              <button key={p.port} onClick={() => applyPreset(p)}
                className={`px-2 py-1 text-xs rounded border font-mono transition-colors ${
                  port === p.port ? 'border-panel-accent text-panel-accent bg-panel-accent/10'
                    : 'border-panel-border text-panel-muted hover:border-panel-text hover:text-panel-text'
                }`}
              >{p.label}</button>
            ))}
          </div>
        </div>

        {/* Action + Direction */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-panel-muted text-xs block mb-1.5">Action</label>
            <select value={action} onChange={e => setAction(e.target.value)}
              className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text focus:outline-none focus:border-panel-accent">
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
              <option value="reject">Reject</option>
              <option value="limit">Limit (rate)</option>
            </select>
          </div>
          <div>
            <label className="text-panel-muted text-xs block mb-1.5">Direction</label>
            <select value={direction} onChange={e => setDirection(e.target.value)}
              className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text focus:outline-none focus:border-panel-accent">
              <option value="in">Inbound (in)</option>
              <option value="out">Outbound (out)</option>
              <option value="">Both</option>
            </select>
          </div>
        </div>

        {/* Port + Proto */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-panel-muted text-xs block mb-1.5">Port</label>
            <input type="text" value={port} onChange={e => setPort(e.target.value)}
              placeholder="80  or  8000:9000"
              className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text placeholder-panel-muted focus:outline-none focus:border-panel-accent font-mono" />
          </div>
          <div>
            <label className="text-panel-muted text-xs block mb-1.5">Protocol</label>
            <select value={proto} onChange={e => setProto(e.target.value)}
              className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text focus:outline-none focus:border-panel-accent">
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="any">Any</option>
            </select>
          </div>
        </div>

        {/* Source IP */}
        <div>
          <label className="text-panel-muted text-xs block mb-1.5">Source IP / CIDR <span className="opacity-60">(leave empty = Anywhere)</span></label>
          <input type="text" value={from} onChange={e => setFrom(e.target.value)}
            placeholder="192.168.1.0/24  or  1.2.3.4"
            className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text placeholder-panel-muted focus:outline-none focus:border-panel-accent font-mono" />
        </div>

        {/* Comment */}
        <div>
          <label className="text-panel-muted text-xs block mb-1.5">Comment <span className="opacity-60">(optional)</span></label>
          <input type="text" value={comment} onChange={e => setComment(e.target.value)}
            placeholder="My web server"
            className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text placeholder-panel-muted focus:outline-none focus:border-panel-accent" />
        </div>

        {/* SSH warning */}
        {isSshBlock && (
          <div className="flex items-start gap-2 bg-panel-red/10 border border-panel-red/30 rounded p-3">
            <AlertTriangle size={14} className="text-panel-red mt-0.5 shrink-0" />
            <p className="text-panel-red text-xs">
              You are blocking port {sshPort} (SSH). This will lock you out of the server!
            </p>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-panel-muted hover:text-panel-text rounded hover:bg-panel-hover">Cancel</button>
          <button
            disabled={!valid || loading || isSshBlock}
            onClick={() => onAdd({ action, direction, proto, port: port.trim(), from: from.trim(), comment: comment.trim() })}
            className="px-3 py-1.5 text-xs bg-panel-accent/20 text-panel-accent rounded hover:bg-panel-accent/30 disabled:opacity-40 flex items-center gap-1.5"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
            Add Rule
          </button>
        </div>
      </div>
    </div>
  );
}

// ── UFW toggle confirm ───────────────────────────────────────────────────────
function ToggleConfirm({ active, sshPort, onConfirm, onClose, loading }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-panel-surface border border-panel-border rounded-xl w-full max-w-sm p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className={active ? 'text-panel-yellow' : 'text-panel-green'} />
          <h3 className="text-panel-text text-sm font-medium">
            {active ? 'Disable Firewall?' : 'Enable Firewall?'}
          </h3>
        </div>
        {!active && (
          <div className="flex items-start gap-2 bg-panel-cyan/10 border border-panel-cyan/30 rounded p-3">
            <Info size={13} className="text-panel-cyan mt-0.5 shrink-0" />
            <p className="text-xs text-panel-cyan">
              SSH port {sshPort} will be automatically allowed before enabling to prevent lockout.
            </p>
          </div>
        )}
        {active && (
          <p className="text-xs text-panel-muted">All incoming connections will be allowed. Only do this if you know what you're doing.</p>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-panel-muted hover:text-panel-text rounded hover:bg-panel-hover">Cancel</button>
          <button disabled={loading} onClick={onConfirm}
            className={`px-3 py-1.5 text-xs rounded disabled:opacity-40 flex items-center gap-1.5 ${
              active ? 'bg-panel-red/20 text-panel-red hover:bg-panel-red/30'
                     : 'bg-panel-green/20 text-panel-green hover:bg-panel-green/30'
            }`}
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
            {active ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function FirewallPanel() {
  const [addOpen,     setAddOpen]     = useState(false);
  const [toggleOpen,  setToggleOpen]  = useState(false);
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [iptablesOpen,setIptablesOpen]= useState(false);
  const [toast,       setToast]       = useState(null);

  const { data, isLoading, refetch, isFetching } = useFirewallStatus();
  const enableMut  = useFirewallEnable();
  const disableMut = useFirewallDisable();
  const addMut     = useAddRule();
  const delMut     = useDeleteRule();

  function showToast(ok, msg) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleToggle() {
    try {
      if (data?.active) {
        await disableMut.mutateAsync();
        showToast(true, 'Firewall disabled');
      } else {
        const res = await enableMut.mutateAsync();
        showToast(true, res.sshAutoAdded
          ? `Firewall enabled — SSH port ${res.sshPort} auto-allowed`
          : 'Firewall enabled');
      }
    } catch (e) {
      showToast(false, e.response?.data?.error || 'Failed');
    } finally {
      setToggleOpen(false);
    }
  }

  async function handleAdd(ruleData) {
    try {
      await addMut.mutateAsync(ruleData);
      setAddOpen(false);
      showToast(true, 'Rule added');
    } catch (e) {
      showToast(false, e.response?.data?.error || 'Failed');
    }
  }

  async function handleDelete() {
    try {
      await delMut.mutateAsync(deleteTarget.num);
      setDeleteTarget(null);
      showToast(true, `Rule #${deleteTarget.num} deleted`);
    } catch (e) {
      showToast(false, e.response?.data?.error || 'Failed');
    }
  }

  const rules  = data?.rules  || [];
  const ipt    = data?.iptables;
  const active = data?.active ?? false;

  return (
    <div className="p-4 h-full flex flex-col gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-panel-text font-medium flex items-center gap-2">
          <Shield size={15} className="text-panel-muted" />
          Firewall
        </h2>
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-panel-accent/20 text-panel-accent rounded hover:bg-panel-accent/30">
          <Plus size={12} /> Add Rule
        </button>
        <button onClick={() => refetch()} disabled={isFetching}
          className="ml-auto p-1.5 text-panel-muted hover:text-panel-text disabled:opacity-40">
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Status card */}
      <div className={`rounded-lg border p-4 flex items-center gap-4 ${
        active
          ? 'bg-panel-green/5 border-panel-green/30'
          : 'bg-panel-red/5 border-panel-red/30'
      }`}>
        {active
          ? <Shield size={22} className="text-panel-green shrink-0" />
          : <ShieldOff size={22} className="text-panel-red shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${active ? 'text-panel-green' : 'text-panel-red'}`}>
            UFW {active ? 'Active' : 'Inactive'}
          </p>
          <p className="text-panel-muted text-xs mt-0.5">
            {active
              ? `${rules.length} rule${rules.length !== 1 ? 's' : ''} · SSH port ${data?.sshPort} ${data?.sshProtected ? 'protected ✓' : 'not in rules'}`
              : 'All incoming connections are permitted (no filtering)'
            }
          </p>
        </div>
        {/* SSH lockout warning */}
        {active && !data?.sshProtected && (
          <div className="flex items-center gap-1.5 text-panel-yellow text-xs">
            <ShieldAlert size={13} />
            SSH not in rules!
          </div>
        )}
        <button
          onClick={() => setToggleOpen(true)}
          disabled={isLoading}
          className={`px-4 py-2 text-xs rounded font-medium transition-colors ${
            active
              ? 'bg-panel-red/20 text-panel-red hover:bg-panel-red/30'
              : 'bg-panel-green/20 text-panel-green hover:bg-panel-green/30'
          }`}
        >
          {active ? 'Disable' : 'Enable'}
        </button>
      </div>

      {/* UFW rules table */}
      <div className="bg-panel-surface border border-panel-border rounded-xl overflow-x-auto">
        <div className="px-4 py-2.5 border-b border-panel-border flex items-center gap-2">
          <span className="text-panel-muted text-xs uppercase tracking-wider">UFW Rules</span>
          <span className="text-panel-muted text-xs ml-1">({rules.length})</span>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-8 bg-panel-hover rounded animate-pulse" />)}
          </div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center text-panel-muted text-xs">
            {active ? 'No rules configured' : 'Enable UFW to manage rules'}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-panel-muted border-b border-panel-border">
              <tr>
                <th className="text-left pl-4 py-2 font-normal w-10">#</th>
                <th className="text-left py-2 font-normal w-20">Action</th>
                <th className="text-left py-2 font-normal w-16 hidden sm:table-cell">Dir</th>
                <th className="text-left py-2 font-normal">To (port/service)</th>
                <th className="text-left py-2 font-normal">From</th>
                <th className="text-right pr-4 py-2 font-normal w-16">Delete</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => {
                const isSsh = data?.sshPort && (
                  rule.to === String(data.sshPort) ||
                  rule.to.startsWith(`${data.sshPort}/`) ||
                  rule.to === 'OpenSSH'
                );
                return (
                  <tr key={rule.num} className="border-b border-panel-border/30 last:border-0 hover:bg-panel-hover/20">
                    <td className="pl-4 py-2 text-panel-muted font-mono">{rule.num}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded border text-xs font-mono ${ACTION_COLOR[rule.action] || 'text-panel-muted border-panel-border'}`}>
                        {rule.action}
                      </span>
                    </td>
                    <td className="py-2 text-panel-muted font-mono hidden sm:table-cell">{rule.direction}</td>
                    <td className="py-2 font-mono text-panel-text">
                      {rule.to}
                      {isSsh && <span className="ml-2 text-panel-yellow text-xs">(SSH)</span>}
                    </td>
                    <td className="py-2 font-mono text-panel-muted">{rule.from}</td>
                    <td className="py-2 pr-4 text-right">
                      {isSsh ? (
                        <span title="SSH rule is protected" className="text-panel-muted/30 cursor-not-allowed">
                          <Trash2 size={12} />
                        </span>
                      ) : (
                        <button onClick={() => setDeleteTarget(rule)}
                          className="p-1 text-panel-muted hover:text-panel-red transition-colors">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* iptables collapsible */}
      {ipt && (
        <div className="bg-panel-surface border border-panel-border rounded-xl overflow-hidden">
          <button
            onClick={() => setIptablesOpen(o => !o)}
            className="w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-panel-hover/30"
          >
            {iptablesOpen ? <ChevronDown size={13} className="text-panel-muted" /> : <ChevronRight size={13} className="text-panel-muted" />}
            <span className="text-panel-muted text-xs uppercase tracking-wider">iptables (read-only)</span>
            <span className="text-panel-muted text-xs ml-1">INPUT: {ipt.input.length} · OUTPUT: {ipt.output.length}</span>
          </button>
          {iptablesOpen && (
            <div className="border-t border-panel-border p-4 space-y-4">
              {[['INPUT', ipt.input], ['OUTPUT', ipt.output]].map(([chain, rows]) => (
                <div key={chain}>
                  <p className="text-panel-muted text-xs font-mono mb-2">Chain {chain}</p>
                  {rows.length === 0 ? (
                    <p className="text-panel-muted text-xs">(no rules)</p>
                  ) : (
                    <table className="w-full text-xs font-mono">
                      <thead className="text-panel-muted">
                        <tr>
                          <th className="text-left pr-4 font-normal pb-1">#</th>
                          <th className="text-left pr-4 font-normal pb-1">Target</th>
                          <th className="text-left pr-4 font-normal pb-1">Proto</th>
                          <th className="text-left pr-4 font-normal pb-1">Source</th>
                          <th className="text-left font-normal pb-1">Dest</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.num} className="border-t border-panel-border/20">
                            <td className="pr-4 py-1 text-panel-muted">{r.num}</td>
                            <td className={`pr-4 py-1 ${r.target === 'ACCEPT' ? 'text-panel-green' : r.target === 'DROP' || r.target === 'REJECT' ? 'text-panel-red' : 'text-panel-text'}`}>{r.target}</td>
                            <td className="pr-4 py-1 text-panel-muted">{r.prot}</td>
                            <td className="pr-4 py-1 text-panel-text">{r.src}</td>
                            <td className="py-1 text-panel-muted">{r.dst}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {addOpen && (
        <AddRuleModal
          sshPort={data?.sshPort}
          onClose={() => setAddOpen(false)}
          onAdd={handleAdd}
          loading={addMut.isPending}
        />
      )}

      {toggleOpen && (
        <ToggleConfirm
          active={active}
          sshPort={data?.sshPort}
          onConfirm={handleToggle}
          onClose={() => setToggleOpen(false)}
          loading={enableMut.isPending || disableMut.isPending}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-panel-surface border border-panel-border rounded-xl w-full max-w-sm p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-panel-yellow" />
              <h3 className="text-panel-text text-sm font-medium">Delete Rule #{deleteTarget.num}?</h3>
            </div>
            <div className="bg-panel-bg rounded p-3 font-mono text-xs space-y-1">
              <p><span className="text-panel-muted">Action:</span> <span className="text-panel-text">{deleteTarget.action}</span></p>
              <p><span className="text-panel-muted">To:</span> <span className="text-panel-text">{deleteTarget.to}</span></p>
              <p><span className="text-panel-muted">From:</span> <span className="text-panel-text">{deleteTarget.from}</span></p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 text-xs text-panel-muted hover:text-panel-text rounded hover:bg-panel-hover">Cancel</button>
              <button disabled={delMut.isPending} onClick={handleDelete}
                className="px-3 py-1.5 text-xs bg-panel-red/20 text-panel-red rounded hover:bg-panel-red/30 disabled:opacity-40 flex items-center gap-1.5">
                {delMut.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
