import React, { useRef } from 'react';
import { useStore } from '../store/useStore.js';
import Sidebar from '../components/layout/Sidebar.jsx';
import TopBar from '../components/layout/TopBar.jsx';
import StatsGrid from '../components/system/StatsGrid.jsx';
import CpuRamChart from '../components/system/CpuRamChart.jsx';
import HardwareInfo from '../components/system/HardwareInfo.jsx';
import MemDetail from '../components/system/MemDetail.jsx';
import NetworkPanel from '../components/system/NetworkPanel.jsx';
import PortsTable from '../components/system/PortsTable.jsx';
import TerminalPane from '../components/terminal/Terminal.jsx';
import FileExplorer from '../components/files/FileExplorer.jsx';
import ContainerList from '../components/docker/ContainerList.jsx';
import ProcessList from '../components/processes/ProcessList.jsx';
import ServiceList from '../components/services/ServiceList.jsx';
import CronList from '../components/cron/CronList.jsx';
import FirewallPanel from '../components/firewall/FirewallPanel.jsx';
import UserPanel from '../components/users/UserPanel.jsx';
import PackagePanel from '../components/packages/PackagePanel.jsx';
import { useSystemStats } from '../hooks/useSystemStats.js';
import { useHardwareInfo } from '../hooks/useHardwareInfo.js';
import { useStore as useTermStore } from '../store/useStore.js';
import { clearTerminalSession } from '../hooks/useTerminal.js';
import { X, Plus, Clipboard, Keyboard } from 'lucide-react';

function OverviewPanel() {
  const { data: stats } = useSystemStats();
  const { data: hardware } = useHardwareInfo();
  return (
    <div className="p-4 flex flex-col gap-4 overflow-auto h-full">
      <h2 className="text-panel-text font-medium">System Overview</h2>

      {/* Top stats cards */}
      <StatsGrid stats={stats} />

      {/* CPU + RAM chart */}
      <CpuRamChart stats={stats} />

      {/* CPU info + OS info */}
      <HardwareInfo hardware={hardware} stats={stats} />

      {/* Memory breakdown */}
      <MemDetail stats={stats} />

      {/* Disk partitions */}
      {stats?.disk && stats.disk.length > 0 && (
        <div className="bg-panel-surface border border-panel-border rounded-lg p-4">
          <h3 className="text-panel-muted text-xs uppercase tracking-wider mb-3">Disk Partitions</h3>
          <div className="space-y-2">
            {stats.disk.map(d => (
              <div key={d.mount} className="flex items-center gap-3 text-xs">
                <span className="text-panel-muted w-20 truncate font-mono">{d.mount}</span>
                <div className="flex-1 h-1.5 bg-panel-hover rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${d.percent > 85 ? 'bg-panel-red' : d.percent > 65 ? 'bg-panel-yellow' : 'bg-panel-accent'}`}
                    style={{ width: `${Math.min(d.percent, 100)}%` }}
                  />
                </div>
                <span className="text-panel-muted font-mono w-24 text-right">
                  {d.used ? `${(d.used / 1073741824).toFixed(1)}G / ${(d.size / 1073741824).toFixed(1)}G` : ''}
                </span>
                <span className="text-panel-text w-10 text-right font-mono">{d.percent?.toFixed(1)}%</span>
              </div>
            ))}
            {stats.diskIO && (
              <div className="flex gap-4 pt-1 text-xs text-panel-muted font-mono">
                <span>Disk R: <span className="text-panel-green">{(stats.diskIO.readSec / 1024).toFixed(0)} KB/s</span></span>
                <span>Disk W: <span className="text-panel-yellow">{(stats.diskIO.writeSec / 1024).toFixed(0)} KB/s</span></span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Network bandwidth chart + interface table */}
      <NetworkPanel stats={stats} hardware={hardware} />

      {/* Listening ports */}
      <PortsTable />
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
