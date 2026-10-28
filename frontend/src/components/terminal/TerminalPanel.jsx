import React, { useRef, useState } from 'react';
import TerminalPane from './Terminal.jsx';
import { useStore } from '../../store/useStore.js';
import { clearTerminalSession } from '../../hooks/useTerminal.js';
import { X, Plus, Clipboard, Keyboard, Columns } from 'lucide-react';

// Telefon klavyesinde olmayan tuşlar. Dokunma odağı terminalden çalmasın diye
// pointerdown'da varsayılan davranış engelleniyor; yoksa her basışta klavye
// kapanıyordu.
const MOBILE_KEYS = [
  { label: 'Esc', seq: '\x1b' },
  { label: 'Tab', seq: '\t' },
  { label: '^C', seq: '\x03', title: 'Ctrl+C' },
  { label: '^D', seq: '\x04', title: 'Ctrl+D' },
  { label: '^L', seq: '\x0c', title: 'Ctrl+L' },
  { label: '^R', seq: '\x12', title: 'Ctrl+R' },
  { label: '↑', seq: '\x1b[A', title: 'Up' },
  { label: '↓', seq: '\x1b[B', title: 'Down' },
  { label: '←', seq: '\x1b[D', title: 'Left' },
  { label: '→', seq: '\x1b[C', title: 'Right' },
  { label: '|', seq: '|' },
  { label: '~', seq: '~' },
  { label: '/', seq: '/' },
  { label: '-', seq: '-' },
];

function MobileKeyBar({ onKey }) {
  return (
    <div className="md:hidden flex items-center gap-1 px-2 py-1.5 border-t border-panel-border bg-panel-surface overflow-x-auto shrink-0">
      {MOBILE_KEYS.map(k => (
        <button
          key={k.label}
          title={k.title || k.label}
          onPointerDown={e => e.preventDefault()}
          onClick={() => onKey(k.seq)}
          className="shrink-0 min-w-[2.5rem] h-9 px-2 rounded border border-panel-border bg-panel-bg text-panel-text
            text-sm font-mono active:bg-panel-accent/20 active:border-panel-accent/40"
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}

// Terminal sekmeleri + split görünümü. Daha önce Dashboard.jsx içinde
// tanımlıydı; panel başına lazy chunk oluşturabilmek için ayrı dosyaya alındı.
export default function TerminalPanel() {
  const {
    terminalTabs, activeTerminalTab, splitMode, splitTabId,
    addTerminalTab, removeTerminalTab, setActiveTerminalTab,
    enableSplit, disableSplit, setSplitTabId,
  } = useStore();
  const termRefs = useRef({});
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
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
      <div className="flex items-center gap-1 px-2 md:px-3 border-b border-panel-border bg-panel-surface h-10 md:h-9 shrink-0 overflow-x-auto">
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
                <span className="text-[10px] text-panel-muted bg-panel-hover px-1 rounded leading-4">R</span>
              )}
              {splitMode && !isRight && (
                <button
                  onClick={e => handleTabClickRight(e, tab.id)}
                  title="Move to right pane"
                  className="text-panel-muted hover:text-panel-accent opacity-50 hover:opacity-100"
                >
                  <Columns size={9} />
                </button>
              )}
              {terminalTabs.length > 1 && (
                <button
                  onClick={e => { e.stopPropagation(); clearTerminalSession(tab.id); removeTerminalTab(tab.id); }}
                  aria-label={`Close ${tab.title}`}
                  className="p-1 -mr-1.5 hover:text-panel-red"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
        <button onClick={addTerminalTab} aria-label="New terminal" title="New terminal" className="p-2 md:p-1 text-panel-muted hover:text-panel-text ml-1 shrink-0">
          <Plus size={13} />
        </button>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            onClick={splitMode ? disableSplit : enableSplit}
            title={splitMode ? 'Single pane' : 'Split'}
            className={`p-2 md:p-1 ${splitMode ? 'text-panel-accent' : 'text-panel-muted hover:text-panel-accent'}`}
          >
            <Columns size={13} />
          </button>
          <button
            onClick={() => termRefs.current[activeTerminalTab]?.focus()}
            title="Open keyboard"
            className="p-2 text-panel-muted hover:text-panel-accent md:hidden"
          >
            <Keyboard size={14} />
          </button>
          <button onClick={openPaste} title="Paste" className="p-2 md:p-1 text-panel-muted hover:text-panel-cyan">
            <Clipboard size={13} />
          </button>
        </div>
      </div>

      {/* Terminal area */}
      {splitMode ? (
        // Dar ekranda yan yana iki terminal okunmuyordu; alt alta bölünüyor.
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          {/* Left pane */}
          <div className="flex-1 min-w-0 min-h-0 relative">
            {terminalTabs.filter(t => t.id !== splitTabId).map(tab => (
              <div key={tab.id} className={`absolute inset-0 ${activeTerminalTab === tab.id ? 'flex' : 'hidden'}`}>
                <TerminalPane tabId={tab.id} ref={el => { termRefs.current[tab.id] = el; }} />
              </div>
            ))}
          </div>
          <div className="h-px md:h-auto md:w-px bg-panel-border shrink-0" />
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

      <MobileKeyBar onKey={seq => termRefs.current[activeTerminalTab]?.sendText(seq)} />

      {showPaste && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-panel-surface border border-panel-border rounded-md p-4 w-full max-w-sm flex flex-col gap-3">
            <p className="text-panel-text text-xs">Paste text here (Ctrl+V) and press Send:</p>
            <textarea
              ref={pasteAreaRef}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setShowPaste(false); }}
              rows={4}
              className="bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text font-mono focus:outline-none focus:border-panel-accent resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowPaste(false)} className="px-3 py-1.5 text-xs text-panel-muted hover:text-panel-text rounded hover:bg-panel-hover">Cancel</button>
              <button onClick={sendPaste} disabled={!pasteText} className="px-3 py-1.5 text-xs bg-panel-accent/20 text-panel-accent rounded hover:bg-panel-accent/30 disabled:opacity-40">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
