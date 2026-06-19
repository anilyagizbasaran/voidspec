import React, { useRef } from 'react';
import { useStore } from '../store/useStore.js';
import Sidebar from '../components/layout/Sidebar.jsx';
import TopBar from '../components/layout/TopBar.jsx';
import TerminalPane from '../components/terminal/Terminal.jsx';
import FileExplorer from '../components/files/FileExplorer.jsx';
import ContainerList from '../components/docker/ContainerList.jsx';
import ProcessList from '../components/processes/ProcessList.jsx';
import ServiceList from '../components/services/ServiceList.jsx';
import CronList from '../components/cron/CronList.jsx';
import FirewallPanel from '../components/firewall/FirewallPanel.jsx';
import PackagePanel from '../components/packages/PackagePanel.jsx';
import LogsPanel from '../components/logs/LogsPanel.jsx';
import LoginHistory from '../components/security/LoginHistory.jsx';
import OverviewGrid from '../components/overview/OverviewGrid.jsx';
import { useStore as useTermStore } from '../store/useStore.js';
import { clearTerminalSession } from '../hooks/useTerminal.js';
import { X, Plus, Clipboard, Keyboard, Columns } from 'lucide-react';

function TerminalPanel() {
  const {
    terminalTabs, activeTerminalTab, splitMode, splitTabId,
    addTerminalTab, removeTerminalTab, setActiveTerminalTab,
    enableSplit, disableSplit, setSplitTabId,
  } = useTermStore();
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

  function handleTabClick(tabId) {
    if (splitMode && tabId === splitTabId) {
      setSplitTabId(activeTerminalTab);
      setActiveTerminalTab(tabId);
    } else {
      setActiveTerminalTab(tabId);
    }
  }

  function handleTabClickRight(e, tabId) {
    e.stopPropagation();
    if (tabId === activeTerminalTab) {
      setSplitTabId(activeTerminalTab);
      setActiveTerminalTab(splitTabId);
    } else {
      setSplitTabId(tabId);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 border-b border-panel-border bg-panel-surface h-9 shrink-0 overflow-x-auto">
        {terminalTabs.map(tab => {
          const isLeft = activeTerminalTab === tab.id;
          const isRight = splitMode && splitTabId === tab.id;
          return (
            <div
              key={tab.id}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-t cursor-pointer shrink-0 ${
                isLeft
                  ? 'text-panel-text bg-panel-bg'
                  : isRight
                    ? 'text-panel-text bg-panel-bg/50 border border-panel-border'
                    : 'text-panel-muted hover:text-panel-text hover:bg-panel-hover'
              }`}
              onClick={() => handleTabClick(tab.id)}
            >
              {tab.title}
              {isRight && (
                <span className="text-[9px] text-panel-muted bg-panel-hover px-1 rounded leading-4">R</span>
              )}
              {splitMode && !isRight && (
                <button
                  onClick={e => handleTabClickRight(e, tab.id)}
                  title="Sağa al"
                  className="text-panel-muted hover:text-panel-accent opacity-50 hover:opacity-100"
                >
                  <Columns size={9} />
                </button>
              )}
              {terminalTabs.length > 1 && (
                <button
                  onClick={e => { e.stopPropagation(); clearTerminalSession(tab.id); removeTerminalTab(tab.id); }}
                  className="hover:text-panel-red"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}
        <button onClick={addTerminalTab} className="p-1 text-panel-muted hover:text-panel-text ml-1 shrink-0">
          <Plus size={13} />
        </button>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            onClick={splitMode ? disableSplit : enableSplit}
            title={splitMode ? 'Tek pane' : 'Yan yana böl'}
            className={`p-1 ${splitMode ? 'text-panel-accent' : 'text-panel-muted hover:text-panel-accent'}`}
          >
            <Columns size={13} />
          </button>
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

      {/* Terminal area */}
      {splitMode ? (
        <div className="flex-1 min-h-0 flex">
          {/* Left pane */}
          <div className="flex-1 min-w-0 min-h-0 relative">
            {terminalTabs.filter(t => t.id !== splitTabId).map(tab => (
              <div key={tab.id} className={`absolute inset-0 ${activeTerminalTab === tab.id ? 'flex' : 'hidden'}`}>
                <TerminalPane tabId={tab.id} ref={el => { termRefs.current[tab.id] = el; }} />
              </div>
            ))}
          </div>
          <div className="w-px bg-panel-border shrink-0" />
          {/* Right pane */}
          <div className="flex-1 min-w-0 min-h-0 relative">
            {splitTabId && (
              <div className="absolute inset-0 flex">
                <TerminalPane tabId={splitTabId} ref={el => { termRefs.current[splitTabId] = el; }} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 relative">
          {terminalTabs.map(tab => (
            <div key={tab.id} className={`absolute inset-0 ${activeTerminalTab === tab.id ? 'flex' : 'hidden'}`}>
              <TerminalPane tabId={tab.id} ref={el => { termRefs.current[tab.id] = el; }} />
            </div>
          ))}
        </div>
      )}

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
  );
}

const panels = {
  dashboard: OverviewGrid,
  terminal: TerminalPanel,
  files: () => <div className="flex-1 min-h-0 overflow-hidden h-full"><FileExplorer /></div>,
  docker: () => <div className="p-4 overflow-auto h-full"><ContainerList /></div>,
  processes: ProcessList,
  services: ServiceList,
  cron: CronList,
  firewall: FirewallPanel,
  packages: PackagePanel,
  logs: LogsPanel,
  loginhistory: LoginHistory,
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
