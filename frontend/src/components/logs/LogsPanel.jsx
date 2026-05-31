import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../../api/client.js';
import { RefreshCw, Search, Filter, FileText, Activity } from 'lucide-react';

const PRIORITY_LABELS = { '': 'All', 'err': 'Error', 'warning': 'Warning', 'info': 'Info', 'debug': 'Debug' };
const PRIORITY_COLORS = { 0: 'text-red-400', 1: 'text-red-400', 2: 'text-red-400', 3: 'text-red-400', 4: 'text-yellow-400', 5: 'text-panel-text', 6: 'text-panel-text', 7: 'text-panel-muted' };

function formatTs(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatBytes(b) {
  if (!b) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.max(b,1)) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function LogsPanel() {
  const [tab, setTab] = useState('journal');
  const [unit, setUnit] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileSearch, setFileSearch] = useState('');
  const bottomRef = useRef(null);

  const { data: unitsData } = useQuery({
    queryKey: ['log-units'],
    queryFn: () => client.get('/logs/units').then(r => r.data),
  });

  const { data: journalData, isLoading: journalLoading, refetch: refetchJournal } = useQuery({
    queryKey: ['logs-journal', unit, priority, search],
    queryFn: () => client.get('/logs/journal', { params: { lines: 300, unit: unit || undefined, priority: priority || undefined, search: search || undefined } }).then(r => r.data),
    enabled: tab === 'journal',
    refetchInterval: 10000,
  });

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ['log-files'],
    queryFn: () => client.get('/logs/files').then(r => r.data),
    enabled: tab === 'files',
  });

  const { data: fileContent, isLoading: fileLoading } = useQuery({
    queryKey: ['log-file', selectedFile, fileSearch],
    queryFn: () => client.get(`/logs/file/${selectedFile}`, { params: { lines: 300, search: fileSearch || undefined } }).then(r => r.data),
    enabled: !!selectedFile,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [journalData]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-panel-border bg-panel-surface shrink-0">
        <button
          onClick={() => setTab('journal')}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded ${tab === 'journal' ? 'bg-panel-accent/20 text-panel-accent' : 'text-panel-muted hover:text-panel-text'}`}
        >
          <Activity size={12} /> Journal
        </button>
        <button
          onClick={() => setTab('files')}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded ${tab === 'files' ? 'bg-panel-accent/20 text-panel-accent' : 'text-panel-muted hover:text-panel-text'}`}
        >
          <FileText size={12} /> Log Files
        </button>
        <div className="flex-1" />
        {tab === 'journal' && (
          <button onClick={refetchJournal} className="p-1 text-panel-muted hover:text-panel-text"><RefreshCw size={13} /></button>
        )}
      </div>

      {tab === 'journal' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-panel-border bg-panel-surface shrink-0 flex-wrap">
            <div className="flex items-center gap-1.5 bg-panel-bg border border-panel-border rounded px-2 py-1">
              <Search size={11} className="text-panel-muted" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ara..."
                className="bg-transparent text-xs text-panel-text focus:outline-none w-32"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-panel-bg border border-panel-border rounded px-2 py-1">
              <Filter size={11} className="text-panel-muted" />
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="bg-transparent text-xs text-panel-text focus:outline-none"
              >
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <select
              value={unit}
              onChange={e => setUnit(e.target.value)}
              className="bg-panel-bg border border-panel-border rounded px-2 py-1 text-xs text-panel-text focus:outline-none max-w-40"
            >
              <option value="">Tüm servisler</option>
              {unitsData?.units?.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <span className="text-panel-muted text-xs ml-auto">{journalData?.total ?? 0} satır</span>
          </div>

          {/* Log entries */}
          <div className="flex-1 overflow-y-auto font-mono text-xs px-4 py-2 space-y-0.5">
            {journalLoading ? (
              <div className="text-panel-muted py-4">Yükleniyor...</div>
            ) : journalData?.entries?.map((e, i) => (
              <div key={i} className="flex gap-2 hover:bg-panel-hover px-1 py-0.5 rounded">
                <span className="text-panel-muted shrink-0 w-20">{formatTs(e.ts)}</span>
                <span className={`shrink-0 w-28 truncate text-panel-muted`}>{e.unit}</span>
                <span className={`flex-1 break-all ${PRIORITY_COLORS[e.priority] ?? 'text-panel-text'}`}>{e.msg}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </>
      )}

      {tab === 'files' && (
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* File list */}
          <div className="md:w-56 border-r border-panel-border overflow-y-auto shrink-0">
            {filesLoading ? (
              <div className="p-4 text-panel-muted text-xs">Yükleniyor...</div>
            ) : filesData?.files?.map(f => (
              <button
                key={f.name}
                onClick={() => { setSelectedFile(f.name); setFileSearch(''); }}
                className={`w-full text-left px-3 py-2 text-xs border-b border-panel-border/50 flex justify-between items-center ${selectedFile === f.name ? 'bg-panel-accent/10 text-panel-accent' : 'text-panel-text hover:bg-panel-hover'}`}
              >
                <span className="truncate">{f.name}</span>
                <span className="text-panel-muted ml-2 shrink-0">{formatBytes(f.size)}</span>
              </button>
            ))}
          </div>

          {/* File content */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {selectedFile ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-panel-border bg-panel-surface shrink-0">
                  <Search size={11} className="text-panel-muted" />
                  <input
                    value={fileSearch}
                    onChange={e => setFileSearch(e.target.value)}
                    placeholder="Dosyada ara..."
                    className="bg-transparent text-xs text-panel-text focus:outline-none flex-1"
                  />
                  <span className="text-panel-muted text-xs">{fileContent?.lines ?? 0} satır</span>
                </div>
                <pre className="flex-1 overflow-auto p-3 text-xs font-mono text-panel-text leading-5 whitespace-pre-wrap break-all">
                  {fileLoading ? 'Yükleniyor...' : fileContent?.content}
                </pre>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-panel-muted text-xs">Sol taraftan bir dosya seçin</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
