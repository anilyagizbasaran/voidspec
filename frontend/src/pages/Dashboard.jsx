import React, { useRef } from 'react';
import { Cpu, MemoryStick, HardDrive, Network, Server, Shield, Container, Activity, Package, Clock, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../store/useStore.js';
import Sidebar from '../components/layout/Sidebar.jsx';
import TopBar from '../components/layout/TopBar.jsx';
import client from '../api/client.js';
import { useSystemStats } from '../hooks/useSystemStats.js';
import { useHardwareInfo } from '../hooks/useHardwareInfo.js';
import TerminalPane from '../components/terminal/Terminal.jsx';
import FileExplorer from '../components/files/FileExplorer.jsx';
import ContainerList from '../components/docker/ContainerList.jsx';
import ProcessList from '../components/processes/ProcessList.jsx';
import ServiceList from '../components/services/ServiceList.jsx';
import CronList from '../components/cron/CronList.jsx';
import FirewallPanel from '../components/firewall/FirewallPanel.jsx';
import UserPanel from '../components/users/UserPanel.jsx';
import PackagePanel from '../components/packages/PackagePanel.jsx';
import LogsPanel from '../components/logs/LogsPanel.jsx';
import { useStore as useTermStore } from '../store/useStore.js';
import { clearTerminalSession } from '../hooks/useTerminal.js';
import { X, Plus, Clipboard, Keyboard } from 'lucide-react';

function fmtBytes(b, dec = 1) {
  if (!b) return '0 B';
  const k = 1024, s = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(Math.max(b,1)) / Math.log(k));
  return `${parseFloat((b / Math.pow(k,i)).toFixed(dec))} ${s[i]}`;
}
function fmtUptime(s) {
  if (!s) return '—';
  const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60);
  return [d&&`${d}d`, h&&`${h}h`, `${m}m`].filter(Boolean).join(' ');
}
function healthColor(pct) {
  if (pct > 85) return { text: 'text-panel-red',    bar: 'bg-panel-red',    glow: 'shadow-[0_0_12px_rgba(248,81,73,0.4)]' };
  if (pct > 65) return { text: 'text-panel-yellow', bar: 'bg-panel-yellow', glow: 'shadow-[0_0_12px_rgba(210,153,34,0.3)]' };
  return           { text: 'text-panel-green',  bar: 'bg-panel-green',  glow: '' };
}

function ResourceCard({ icon: Icon, label, percent, primary, secondary, accent, onClick }) {
  const hc = percent != null ? healthColor(percent) : { text: accent, bar: accent.replace('text-','bg-'), glow: '' };
  return (
    <button
      onClick={onClick}
      className={`group relative bg-panel-surface border border-panel-border rounded-xl p-4 text-left transition-all duration-200 overflow-hidden
        ${onClick ? 'hover:border-panel-border/80 hover:bg-[#1c2128] cursor-pointer' : 'cursor-default'}`}
    >
      {/* subtle top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${hc.bar} opacity-60`} />

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md bg-panel-hover`}>
            <Icon size={13} className={hc.text} />
          </div>
          <span className="text-panel-muted text-xs tracking-wide">{label}</span>
        </div>
        {onClick && <ChevronRight size={13} className="text-panel-muted/30 group-hover:text-panel-muted/70 transition-colors mt-0.5" />}
      </div>

      <div className={`text-2xl font-bold font-mono mb-0.5 ${hc.text}`}>{primary}</div>
      <div className="text-panel-muted text-[11px] font-mono mb-3 truncate">{secondary}</div>

      {percent != null && (
        <div className="h-1 bg-panel-hover rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${hc.bar}`} style={{ width: `${Math.min(percent,100)}%` }} />
        </div>
      )}
    </button>
  );
}

function StatusCard({ icon: Icon, label, value, sub, status, onClick }) {
  const cfg = {
    ok:   { dot: 'bg-panel-green',  ring: 'border-panel-green/20',  bg: 'hover:bg-panel-green/5'  },
    warn: { dot: 'bg-panel-yellow', ring: 'border-panel-yellow/20', bg: 'hover:bg-panel-yellow/5' },
    err:  { dot: 'bg-panel-red',    ring: 'border-panel-red/20',    bg: 'hover:bg-panel-red/5'    },
    off:  { dot: 'bg-panel-muted',  ring: 'border-panel-border',    bg: 'hover:bg-panel-hover'    },
  }[status] || { dot: 'bg-panel-muted', ring: 'border-panel-border', bg: 'hover:bg-panel-hover' };

  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-3 bg-panel-surface border ${cfg.ring} rounded-xl px-4 py-3 w-full text-left transition-all duration-200 ${cfg.bg} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="relative shrink-0">
        <Icon size={16} className="text-panel-muted" />
        <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${cfg.dot} ring-2 ring-panel-surface`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-panel-muted mb-0.5">{label}</div>
        <div className="text-panel-text text-xs font-medium truncate">{value}</div>
        {sub && <div className="text-panel-muted text-[11px] truncate">{sub}</div>}
      </div>
      {onClick && <ChevronRight size={12} className="text-panel-muted/30 group-hover:text-panel-muted/70 shrink-0 transition-colors" />}
    </button>
  );
}

function OverviewPanel() {
  const { data: stats } = useSystemStats();
  const { data: hardware } = useHardwareInfo();
  const { setActiveTab } = useStore();

  const { data: fw }    = useQuery({ queryKey: ['fw-status'],  queryFn: () => client.get('/firewall/status').then(r => r.data),  refetchInterval: 30000 });
  const { data: dock }  = useQuery({ queryKey: ['containers'], queryFn: () => client.get('/docker/containers').then(r => r.data), refetchInterval: 10000 });
  const { data: svcs }  = useQuery({ queryKey: ['services'],   queryFn: () => client.get('/services').then(r => r.data),          refetchInterval: 30000 });
  const { data: procs } = useQuery({ queryKey: ['processes'],  queryFn: () => client.get('/processes').then(r => r.data),          refetchInterval: 10000 });

  const cpu    = stats?.cpu;
  const mem    = stats?.memory;
  const disk0  = stats?.disk?.[0];
  const netRx  = stats?.network?.reduce((s,n)=>s+(n.rx||0),0)||0;
  const netTx  = stats?.network?.reduce((s,n)=>s+(n.tx||0),0)||0;

  const dockList     = Array.isArray(dock) ? dock : dock?.containers ?? [];
  const dockRunning  = dockList.filter(c=>c.state==='running').length;
  const dockTotal    = dockList.length;
  const activeSvcs   = svcs?.services?.filter(s=>s.active==='active').length;
  const fwActive     = fw?.active;
  const temp         = hardware?.cpu?.temperature;

  return (
    <div className="p-4 flex flex-col gap-5 h-full overflow-auto">

      {/* ── Identity bar ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-panel-green animate-pulse" />
          <span className="text-panel-text font-semibold tracking-wide">{hardware?.os?.hostname ?? '—'}</span>
        </div>
        <span className="text-panel-border">|</span>
        <span className="text-panel-muted">{hardware?.os ? `${hardware.os.distro} ${hardware.os.release}` : '—'}</span>
        <span className="text-panel-border">|</span>
        <span className="text-panel-muted">kernel <span className="text-panel-text font-mono">{hardware?.os?.kernel ?? '—'}</span></span>
        <span className="text-panel-border">|</span>
        <span className="text-panel-muted">up <span className="text-panel-green font-mono font-medium">{fmtUptime(stats?.uptime)}</span></span>
        {temp != null && (
          <>
            <span className="text-panel-border">|</span>
            <span className={`font-mono font-medium ${temp>80?'text-panel-red':temp>60?'text-panel-yellow':'text-panel-muted'}`}>{temp.toFixed(0)}°C</span>
          </>
        )}
      </div>

      {/* ── Resource cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ResourceCard
          icon={Cpu} label="CPU Usage"
          percent={cpu?.load}
          primary={cpu ? `${cpu.load}%` : '—'}
          secondary={cpu ? `${cpu.cores} cores · load avg ${cpu.loadAvg?.[0]?.toFixed(2) ?? '—'}` : ''}
          accent="text-panel-green"
          onClick={() => setActiveTab('processes')}
        />
        <ResourceCard
          icon={MemoryStick} label="Memory"
          percent={mem?.percent}
          primary={mem ? `${mem.percent}%` : '—'}
          secondary={mem ? `${fmtBytes(mem.used)} of ${fmtBytes(mem.total)} used` : ''}
          accent="text-panel-cyan"
          onClick={() => setActiveTab('processes')}
        />
        <ResourceCard
          icon={HardDrive} label="Disk"
          percent={disk0?.percent}
          primary={disk0 ? `${disk0.percent?.toFixed(1)}%` : '—'}
          secondary={disk0 ? `${fmtBytes(disk0.used)} of ${fmtBytes(disk0.size)} used` : ''}
          accent="text-panel-accent"
          onClick={() => setActiveTab('files')}
        />
        <ResourceCard
          icon={Network} label="Network"
          percent={null}
          primary={`${fmtBytes(netRx)}/s`}
          secondary={`↓ in · ↑ ${fmtBytes(netTx)}/s out`}
          accent="text-panel-yellow"
        />
      </div>

      {/* ── Status row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatusCard
          icon={Shield} label="Firewall"
          value={fwActive == null ? 'Checking…' : fwActive ? 'Enabled' : 'Disabled'}
          sub={fwActive ? `${fw?.rules?.length ?? 0} rules active` : 'No protection'}
          status={fwActive ? 'ok' : fwActive === false ? 'err' : 'off'}
          onClick={() => setActiveTab('firewall')}
        />
        <StatusCard
          icon={Container} label="Docker"
          value={dock != null ? `${dockRunning} / ${dockTotal} running` : '—'}
          sub={dock != null ? `${dockTotal - dockRunning} stopped` : null}
          status={dockRunning > 0 ? 'ok' : dockRunning === 0 && dockTotal > 0 ? 'warn' : 'off'}
          onClick={() => setActiveTab('docker')}
        />
        <StatusCard
          icon={Activity} label="Services"
          value={activeSvcs != null ? `${activeSvcs} active` : '—'}
          sub={svcs ? `${svcs.services?.filter(s=>s.active==='failed').length ?? 0} failed` : null}
          status={svcs?.services?.some(s=>s.active==='failed') ? 'err' : activeSvcs > 0 ? 'ok' : 'off'}
          onClick={() => setActiveTab('services')}
        />
        <StatusCard
          icon={Cpu} label="Processes"
          value={procs ? `${procs.total} total` : '—'}
          sub={procs ? `${procs.running} running · ${procs.sleeping} sleeping` : null}
          status="ok"
          onClick={() => setActiveTab('processes')}
        />
      </div>

      {/* ── Bottom: Top Processes + Recent Logs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-2">

        {/* Top Processes */}
        <TopProcesses procs={procs} onViewAll={() => setActiveTab('processes')} />

        {/* Recent Logs */}
        <div className="bg-panel-surface border border-panel-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-panel-muted" />
              <span className="text-xs text-panel-muted tracking-wide">Recent Errors & Warnings</span>
            </div>
            <button onClick={() => setActiveTab('logs')} className="text-[11px] text-panel-muted/60 hover:text-panel-accent transition-colors">
              tümü →
            </button>
          </div>
          <RecentLogs />
        </div>

      </div>
    </div>
  );
}

function TopProcesses({ procs, onViewAll }) {
  const [sortBy, setSortBy] = React.useState('cpu');

  const sorted = React.useMemo(() => {
    if (!procs?.list) return [];
    return [...procs.list]
      .sort((a, b) => sortBy === 'cpu' ? (b.cpu||0) - (a.cpu||0) : (b.mem||0) - (a.mem||0))
      .slice(0, 6);
  }, [procs, sortBy]);

  return (
    <div className="bg-panel-surface border border-panel-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-panel-muted" />
          <span className="text-xs text-panel-muted tracking-wide">Top Processes</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md overflow-hidden border border-panel-border text-[11px]">
            <button onClick={() => setSortBy('cpu')} className={`px-2 py-0.5 transition-colors ${sortBy === 'cpu' ? 'bg-panel-hover text-panel-text' : 'text-panel-muted hover:text-panel-text'}`}>CPU</button>
            <button onClick={() => setSortBy('mem')} className={`px-2 py-0.5 transition-colors border-l border-panel-border ${sortBy === 'mem' ? 'bg-panel-hover text-panel-text' : 'text-panel-muted hover:text-panel-text'}`}>MEM</button>
          </div>
          <button onClick={onViewAll} className="text-[11px] text-panel-muted/60 hover:text-panel-accent transition-colors">tümü →</button>
        </div>
      </div>
      <div className="divide-y divide-panel-border/40">
        {sorted.map((p, i) => {
          const cpuColor = p.cpu > 50 ? 'text-panel-red' : p.cpu > 20 ? 'text-panel-yellow' : 'text-panel-muted';
          const memColor = p.mem > 500000 ? 'text-panel-red' : p.mem > 200000 ? 'text-panel-yellow' : 'text-panel-muted';
          return (
            <div key={p.pid} className="flex items-center gap-3 px-4 py-2 hover:bg-panel-hover/50 transition-colors">
              <span className="text-panel-muted/50 text-[10px] w-3 shrink-0">{i+1}</span>
              <span className="text-panel-text text-xs font-mono truncate flex-1">{p.name}</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs font-mono w-12 text-right ${sortBy === 'cpu' ? cpuColor : 'text-panel-muted'}`}>
                  {p.cpu?.toFixed(1)}%
                </span>
                <span className={`text-xs font-mono w-16 text-right ${sortBy === 'mem' ? memColor : 'text-panel-muted'}`}>
                  {fmtBytes((p.mem||0)*1024)}
                </span>
              </div>
            </div>
          );
        })}
        {!procs && <div className="px-4 py-6 text-center text-panel-muted text-xs">Yükleniyor…</div>}
      </div>
    </div>
  );
}

function RecentLogs() {
  const { data } = useQuery({
    queryKey: ['overview-logs'],
    queryFn: () => client.get('/logs/journal', { params: { lines: 20, priority: 'warning' } }).then(r => r.data),
    refetchInterval: 15000,
  });

  const PCOLOR = { 0:'text-panel-red', 1:'text-panel-red', 2:'text-panel-red', 3:'text-panel-red', 4:'text-panel-yellow' };

  function fmtTs(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }

  if (!data?.entries?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <span className="w-2 h-2 rounded-full bg-panel-green" />
        <span className="text-panel-muted text-xs">Hata veya uyarı yok</span>
      </div>
    );
  }

  return (
    <div className="divide-y divide-panel-border/40 overflow-hidden">
      {data.entries.slice(0,6).map((e, i) => (
        <div key={i} className="flex gap-3 px-4 py-2 hover:bg-panel-hover/50 transition-colors">
          <span className="text-panel-muted text-[10px] font-mono shrink-0 mt-0.5 w-16">{fmtTs(e.ts)}</span>
          <div className="flex-1 min-w-0">
            <div className="text-panel-muted text-[10px] truncate mb-0.5">{e.unit}</div>
            <div className={`text-xs font-mono truncate ${PCOLOR[e.priority] ?? 'text-panel-text'}`}>{e.msg}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TerminalPanel() {
  const { terminalTabs, activeTerminalTab, addTerminalTab, removeTerminalTab, setActiveTerminalTab } = useTermStore();
  const termRefs = useRef({});
  const [showPaste, setShowPaste] = React.useState(false);
  const [pasteText, setPasteText] = React.useState('');
  const pasteAreaRef = useRef(null);

  function openPaste() {
    setPasteText('');
    setShowPaste(true);
    setTimeout(() => pasteAreaRef.current?.focus(), 50);
  }

  function sendPaste() {
    if (pasteText) termRefs.current[activeTerminalTab]?.sendText(pasteText);
    setShowPaste(false);
    setPasteText('');
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 border-b border-panel-border bg-panel-surface h-9 shrink-0 overflow-x-auto">
        {terminalTabs.map(tab => (
          <div
            key={tab.id}
            className={`flex items-center gap-2 px-3 py-1 text-xs rounded-t cursor-pointer shrink-0 ${
              activeTerminalTab === tab.id
                ? 'text-panel-text bg-panel-bg'
                : 'text-panel-muted hover:text-panel-text hover:bg-panel-hover'
            }`}
            onClick={() => setActiveTerminalTab(tab.id)}
          >
            {tab.title}
            {terminalTabs.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); clearTerminalSession(tab.id); removeTerminalTab(tab.id); }}
                className="hover:text-panel-red"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
        <button onClick={addTerminalTab} className="p-1 text-panel-muted hover:text-panel-text ml-1 shrink-0">
          <Plus size={13} />
        </button>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            onClick={() => termRefs.current[activeTerminalTab]?.focus()}
            title="Klavyeyi Aç"
            className="p-1 text-panel-muted hover:text-panel-accent md:hidden"
          >
            <Keyboard size={14} />
          </button>
          <button onClick={openPaste} title="Yapıştır" className="p-1 text-panel-muted hover:text-panel-cyan">
            <Clipboard size={13} />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        {terminalTabs.map(tab => (
          <div key={tab.id} className={`absolute inset-0 ${activeTerminalTab === tab.id ? 'flex' : 'hidden'}`}>
            <TerminalPane tabId={tab.id} ref={el => { termRefs.current[tab.id] = el; }} />
          </div>
        ))}

        {showPaste && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-panel-surface border border-panel-border rounded-lg p-4 w-full max-w-sm flex flex-col gap-3">
              <p className="text-panel-text text-xs">Metni buraya yapıştırın (Ctrl+V) ve Gönder'e basın:</p>
              <textarea
                ref={pasteAreaRef}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setShowPaste(false); }}
                rows={4}
                className="bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text font-mono focus:outline-none focus:border-panel-accent resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowPaste(false)} className="px-3 py-1.5 text-xs text-panel-muted hover:text-panel-text rounded hover:bg-panel-hover">İptal</button>
                <button onClick={sendPaste} disabled={!pasteText} className="px-3 py-1.5 text-xs bg-panel-accent/20 text-panel-accent rounded hover:bg-panel-accent/30 disabled:opacity-40">Gönder</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const panels = {
  dashboard: OverviewPanel,
  terminal: TerminalPanel,
  files: () => <div className="flex-1 min-h-0 overflow-hidden h-full"><FileExplorer /></div>,
  docker: () => <div className="p-4 overflow-auto h-full"><ContainerList /></div>,
  processes: ProcessList,
  services: ServiceList,
  cron: CronList,
  firewall: FirewallPanel,
  users: UserPanel,
  packages: PackagePanel,
  logs: LogsPanel,
};

export default function Dashboard() {
  const activeTab = useStore(s => s.activeTab);
  const Panel = panels[activeTab] || panels.dashboard;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        {/* pb-14 on mobile to avoid content hiding behind bottom nav */}
        <main className="flex-1 min-h-0 overflow-hidden pb-14 md:pb-0">
          <Panel />
        </main>
      </div>
    </div>
  );
}
