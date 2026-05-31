import React, { useState, useMemo } from 'react';
import { Clock, Plus, Pencil, Trash2, RefreshCw, X, Check, FolderOpen, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { useCron, useAddCron, useUpdateCron, useDeleteCron } from '../../hooks/useCron.js';

// ── Cron humanizer ────────────────────────────────────────────────────────────
const SPECIAL = {
  '@reboot': 'At reboot',
  '@hourly': 'Every hour',
  '@daily': 'Every day at midnight',
  '@midnight': 'Every day at midnight',
  '@weekly': 'Every Sunday at midnight',
  '@monthly': 'On the 1st of each month',
  '@annually': 'Once a year (Jan 1)',
  '@yearly': 'Once a year (Jan 1)',
};

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

function describeField(val, unit, names) {
  if (val === '*') return null;
  if (val.startsWith('*/')) return `every ${val.slice(2)} ${unit}`;
  if (val.includes(',')) {
    const parts = val.split(',').map(v => names ? names[parseInt(v)] || v : ordinal(parseInt(v)));
    return parts.join(', ');
  }
  if (val.includes('-')) {
    const [a, b] = val.split('-');
    const na = names ? names[parseInt(a)] || a : a;
    const nb = names ? names[parseInt(b)] || b : b;
    return `${na}–${nb}`;
  }
  if (val.includes('/')) {
    const [range, step] = val.split('/');
    return `every ${step} ${unit}${range !== '*' ? ` from ${range}` : ''}`;
  }
  if (names) return names[parseInt(val)] || val;
  return ordinal(parseInt(val));
}

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function humanizeCron(expr) {
  if (!expr) return '';
  if (SPECIAL[expr]) return SPECIAL[expr];
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hr, dom, mon, dow] = parts;

  const pieces = [];
  const dowDesc = describeField(dow, 'day', DAYS);
  const domDesc = describeField(dom, 'day-of-month', null);
  const monDesc = describeField(mon, 'month', MONTHS);
  const hrDesc  = describeField(hr,  'hour', null);
  const minDesc = describeField(min, 'minute', null);

  if (min === '0' && hr !== '*' && dom === '*' && mon === '*' && dow === '*') {
    const h = parseInt(hr);
    if (!isNaN(h)) return `Daily at ${h.toString().padStart(2,'0')}:00`;
  }
  if (min !== '*' && hr !== '*' && dom === '*' && mon === '*' && dow === '*') {
    const h = parseInt(hr), m = parseInt(min);
    if (!isNaN(h) && !isNaN(m))
      return `Daily at ${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  }

  if (dowDesc) pieces.push(`on ${dowDesc}`);
  if (domDesc) pieces.push(`on the ${domDesc}`);
  if (monDesc) pieces.push(`in ${monDesc}`);
  if (hrDesc)  pieces.push(`at ${hrDesc}h`);
  else if (hr === '*') pieces.push('every hour');
  if (minDesc) pieces.push(`minute ${minDesc}`);
  else if (min === '0') pieces.push('on the hour');
  else if (min !== '*') pieces.push(`at minute ${min}`);

  return pieces.length ? pieces.join(', ') : 'Every minute';
}
// ─────────────────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: '@reboot',  value: '@reboot' },
  { label: '@hourly',  value: '@hourly' },
  { label: '@daily',   value: '@daily' },
  { label: '@weekly',  value: '@weekly' },
  { label: '@monthly', value: '@monthly' },
  { label: 'Every 5m', value: '*/5 * * * *' },
  { label: 'Every 15m',value: '*/15 * * * *' },
  { label: 'Every 30m',value: '*/30 * * * *' },
];

const SOURCE_LABEL = {
  root:   { label: 'User (root)', color: 'text-panel-accent' },
  system: { label: '/etc/crontab', color: 'text-panel-muted' },
};
function sourceLabel(src) {
  if (SOURCE_LABEL[src]) return SOURCE_LABEL[src];
  if (src.startsWith('cron.d/')) return { label: src, color: 'text-panel-yellow' };
  return { label: src, color: 'text-panel-muted' };
}

// ── Job form modal ────────────────────────────────────────────────────────────
function JobModal({ initial, onSave, onClose, loading }) {
  const [schedule, setSchedule] = useState(initial?.schedule || '');
  const [command, setCommand] = useState(initial?.command || '');
  const isEdit = !!initial;

  const preview = humanizeCron(schedule);
  const valid = schedule.trim() && command.trim();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-panel-surface border border-panel-border rounded-lg w-full max-w-lg flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-panel-muted" />
          <h3 className="text-panel-text text-sm font-medium">{isEdit ? 'Edit Job' : 'New Cron Job'}</h3>
          <button onClick={onClose} className="ml-auto text-panel-muted hover:text-panel-text"><X size={14} /></button>
        </div>

        {/* Presets */}
        <div>
          <p className="text-panel-muted text-xs mb-2">Quick presets</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setSchedule(p.value)}
                className={`px-2 py-1 text-xs rounded border font-mono transition-colors ${
                  schedule === p.value
                    ? 'border-panel-accent text-panel-accent bg-panel-accent/10'
                    : 'border-panel-border text-panel-muted hover:border-panel-text hover:text-panel-text'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule input */}
        <div>
          <label className="text-panel-muted text-xs block mb-1.5">
            Schedule <span className="text-panel-muted/60">(cron expression or @special)</span>
          </label>
          <input
            type="text"
            value={schedule}
            onChange={e => setSchedule(e.target.value)}
            placeholder="* * * * *   or   @daily"
            className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text placeholder-panel-muted focus:outline-none focus:border-panel-accent font-mono"
          />
          {schedule && (
            <p className={`mt-1.5 text-xs font-mono ${preview ? 'text-panel-cyan' : 'text-panel-red'}`}>
              {preview || 'Invalid expression'}
            </p>
          )}
          <p className="mt-1 text-panel-muted/60 text-xs font-mono">min  hour  dom  mon  dow</p>
        </div>

        {/* Command input */}
        <div>
          <label className="text-panel-muted text-xs block mb-1.5">Command</label>
          <input
            type="text"
            value={command}
            onChange={e => setCommand(e.target.value)}
            placeholder="/usr/local/bin/backup.sh >> /var/log/backup.log 2>&1"
            className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text placeholder-panel-muted focus:outline-none focus:border-panel-accent font-mono"
          />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-panel-muted hover:text-panel-text rounded hover:bg-panel-hover">
            Cancel
          </button>
          <button
            disabled={!valid || loading}
            onClick={() => onSave({ schedule: schedule.trim(), command: command.trim() })}
            className="px-3 py-1.5 text-xs bg-panel-accent/20 text-panel-accent rounded hover:bg-panel-accent/30 disabled:opacity-40 flex items-center gap-1.5"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
            {isEdit ? 'Save' : 'Add Job'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────────
function DeleteConfirm({ job, onConfirm, onClose, loading }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-panel-surface border border-panel-border rounded-lg w-full max-w-sm p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-panel-yellow" />
          <h3 className="text-panel-text text-sm font-medium">Delete Job?</h3>
        </div>
        <div className="bg-panel-bg rounded p-3 font-mono text-xs text-panel-muted space-y-0.5">
          <p className="text-panel-text">{job.schedule}</p>
          <p>{job.command}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-panel-muted hover:text-panel-text rounded hover:bg-panel-hover">Cancel</button>
          <button
            disabled={loading}
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs bg-panel-red/20 text-panel-red rounded hover:bg-panel-red/30 disabled:opacity-40 flex items-center gap-1.5"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'root', label: 'User' },
  { id: 'system', label: 'System' },
];

export default function CronList() {
  const [filterTab, setFilterTab] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const { data, isLoading, refetch, isFetching } = useCron();
  const addMutation   = useAddCron();
  const updateMutation = useUpdateCron();
  const deleteMutation = useDeleteCron();

  function showToast(ok, msg) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleAdd({ schedule, command }) {
    try {
      await addMutation.mutateAsync({ schedule, command });
      setAddOpen(false);
      showToast(true, 'Job added');
    } catch (e) {
      showToast(false, e.response?.data?.error || 'Failed');
    }
  }

  async function handleEdit({ schedule, command }) {
    try {
      await updateMutation.mutateAsync({ id: editTarget.id, schedule, command });
      setEditTarget(null);
      showToast(true, 'Job updated');
    } catch (e) {
      showToast(false, e.response?.data?.error || 'Failed');
    }
  }

  async function handleToggle(job) {
    try {
      await updateMutation.mutateAsync({ id: job.id, enabled: !job.enabled });
      showToast(true, job.enabled ? 'Job disabled' : 'Job enabled');
    } catch (e) {
      showToast(false, e.response?.data?.error || 'Failed');
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      showToast(true, 'Job deleted');
    } catch (e) {
      showToast(false, e.response?.data?.error || 'Failed');
    }
  }

  const jobs = data?.jobs || [];
  const dirs = data?.dirs || {};

  const filtered = useMemo(() => {
    if (filterTab === 'all') return jobs;
    if (filterTab === 'system') return jobs.filter(j => j.source !== 'root');
    return jobs.filter(j => j.source === filterTab);
  }, [jobs, filterTab]);

  const counts = useMemo(() => ({
    all: jobs.length,
    root: jobs.filter(j => j.source === 'root').length,
    system: jobs.filter(j => j.source !== 'root').length,
  }), [jobs]);

  const dirEntries = Object.entries(dirs).filter(([, files]) => files.length > 0);

  return (
    <div className="p-4 h-full flex flex-col gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-panel-text font-medium flex items-center gap-2">
          <Clock size={15} className="text-panel-muted" />
          Cron Jobs
        </h2>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-panel-accent/20 text-panel-accent rounded hover:bg-panel-accent/30 transition-colors"
        >
          <Plus size={12} /> New Job
        </button>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto p-1.5 text-panel-muted hover:text-panel-text disabled:opacity-40"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
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
            {tab.label} <span className="ml-1 opacity-60">{counts[tab.id]}</span>
          </button>
        ))}
      </div>

      {/* Job table */}
      <div className="bg-panel-surface border border-panel-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-panel-muted border-b border-panel-border bg-panel-surface">
            <tr>
              <th className="text-left pl-4 py-2 font-normal w-6"></th>
              <th className="text-left py-2 font-normal">Schedule</th>
              <th className="text-left py-2 font-normal hidden md:table-cell">Human readable</th>
              <th className="text-left py-2 font-normal">Command</th>
              <th className="text-left py-2 font-normal hidden sm:table-cell w-28">Source</th>
              <th className="text-right pr-4 py-2 font-normal w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-panel-border/30">
                  <td colSpan={6} className="py-2 pl-4"><div className="h-4 bg-panel-hover rounded animate-pulse" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-panel-muted">
                  {filterTab === 'root' ? (
                    <span>No user cron jobs — <button onClick={() => setAddOpen(true)} className="text-panel-accent underline">add one</button></span>
                  ) : 'No jobs in this category'}
                </td>
              </tr>
            ) : (
              filtered.map(job => {
                const src = sourceLabel(job.source);
                return (
                  <tr key={job.id} className={`border-b border-panel-border/30 last:border-0 hover:bg-panel-hover/20 ${!job.enabled ? 'opacity-50' : ''}`}>
                    {/* Enabled dot */}
                    <td className="pl-4 py-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${job.enabled ? 'bg-panel-green' : 'bg-panel-muted'}`} />
                    </td>

                    {/* Schedule */}
                    <td className="py-2 pr-3 font-mono text-panel-text whitespace-nowrap">{job.schedule}</td>

                    {/* Human readable */}
                    <td className="py-2 pr-3 text-panel-cyan hidden md:table-cell text-xs whitespace-nowrap">
                      {humanizeCron(job.schedule)}
                    </td>

                    {/* Command */}
                    <td className="py-2 pr-3 font-mono text-panel-muted max-w-xs truncate" title={job.command}>
                      {job.user && <span className="text-panel-yellow mr-1">{job.user}</span>}
                      {job.command}
                    </td>

                    {/* Source */}
                    <td className={`py-2 font-mono hidden sm:table-cell text-xs ${src.color}`}>
                      {src.label}
                    </td>

                    {/* Actions */}
                    <td className="py-2 pr-4">
                      <div className="flex items-center justify-end gap-1">
                        {job.editable ? (
                          <>
                            <button
                              onClick={() => handleToggle(job)}
                              title={job.enabled ? 'Disable' : 'Enable'}
                              className="p-1.5 text-panel-muted hover:text-panel-text rounded transition-colors"
                            >
                              {job.enabled
                                ? <ToggleRight size={14} className="text-panel-green" />
                                : <ToggleLeft size={14} />
                              }
                            </button>
                            <button
                              onClick={() => setEditTarget(job)}
                              title="Edit"
                              className="p-1.5 text-panel-muted hover:text-panel-accent rounded transition-colors"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(job)}
                              title="Delete"
                              className="p-1.5 text-panel-muted hover:text-panel-red rounded transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        ) : (
                          <span className="text-panel-muted/40 text-xs">read-only</span>
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

      {/* Cron directories */}
      {dirEntries.length > 0 && (
        <div className="bg-panel-surface border border-panel-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen size={13} className="text-panel-muted" />
            <span className="text-panel-muted text-xs uppercase tracking-wider">Cron Directories</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {dirEntries.map(([dir, files]) => (
              <div key={dir}>
                <p className="text-panel-muted text-xs mb-1.5 font-mono">/etc/cron.{dir}/</p>
                <div className="space-y-0.5">
                  {files.map(f => (
                    <p key={f} className="text-panel-text text-xs font-mono">{f}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {addOpen && (
        <JobModal
          onSave={handleAdd}
          onClose={() => setAddOpen(false)}
          loading={addMutation.isPending}
        />
      )}
      {editTarget && (
        <JobModal
          initial={editTarget}
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
          loading={updateMutation.isPending}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          job={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          loading={deleteMutation.isPending}
        />
      )}

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
