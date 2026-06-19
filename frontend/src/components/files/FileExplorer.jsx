import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../../api/client.js';
import {
  Folder, File, ChevronRight, ArrowLeft, ArrowRight, RefreshCw,
  Download, Trash2, FolderPlus, Upload, Eye, X,
  Link, Pencil, Check, Archive, BarChart2, Copy, Scissors, Clipboard,
  HardDrive, Cpu, Package, Box, Users, Globe, ScrollText, Settings2, Clock,
} from 'lucide-react';
import { format } from 'date-fns';

function formatBytes(bytes) {
  if (!bytes) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const CHART_COLORS = [
  '#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b',
  '#ef4444','#ec4899','#84cc16','#f97316','#14b8a6',
];

const DISK_OV_KEY = 'sp-disk-smart-v1';

const CAT_ICONS = {
  system:   <Cpu size={12} />,
  apps:     <Package size={12} />,
  docker:   <Box size={12} />,
  userdata: <Users size={12} />,
  web:      <Globe size={12} />,
  logs:     <ScrollText size={12} />,
  config:   <Settings2 size={12} />,
  temp:     <Clock size={12} />,
};

function DiskOverview({ onNavigate }) {
  const [editing, setEditing] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(DISK_OV_KEY) ?? '[]')); }
    catch { return new Set(); }
  });

  const { data, isLoading } = useQuery({
    queryKey: ['disk-smart-overview'],
    queryFn: () => client.get('/files/smart-overview').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  function toggleHide(id) {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(DISK_OV_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const cats = data?.categories ?? [];
  const disk = data?.disk;
  const visible = cats.filter(c => !hidden.has(c.id));
  const max = Math.max(...visible.map(c => c.size), 1);

  return (
    <div className="border-b border-panel-border bg-panel-bg px-3 pt-2.5 pb-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-panel-muted flex items-center gap-1.5">
          <HardDrive size={11} /> Disk Kullanımı
        </span>
        <button
          onClick={() => setEditing(v => !v)}
          className={`text-xs px-1.5 py-0.5 rounded transition-colors ${editing ? 'text-panel-accent bg-panel-accent/10' : 'text-panel-muted hover:text-panel-text hover:bg-panel-hover'}`}
        >
          {editing ? 'Tamam' : 'Düzenle'}
        </button>
      </div>

      {/* Total disk bar */}
      {disk && !editing && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-panel-muted mb-1">
            <span className="tabular-nums">{formatBytes(disk.used)} kullanıldı</span>
            <span className="tabular-nums opacity-60">{formatBytes(disk.avail)} boş / {formatBytes(disk.total)}</span>
          </div>
          <div className="h-2 bg-panel-surface rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(disk.used / disk.total * 100, 100)}%`,
                background: disk.used / disk.total > 0.85
                  ? '#ef4444'
                  : disk.used / disk.total > 0.7
                    ? '#f59e0b'
                    : '#6366f1',
                opacity: 0.8,
              }}
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-1.5">
          {[1,2,3,4,5].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-4 h-3 bg-panel-surface rounded animate-pulse" />
              <div className="w-28 h-2.5 bg-panel-surface rounded animate-pulse" />
              <div className="flex-1 h-1.5 bg-panel-surface rounded-full animate-pulse" style={{ opacity: 0.9 - i * 0.12 }} />
              <div className="w-16 h-2.5 bg-panel-surface rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : editing ? (
        <div className="grid grid-cols-2 gap-0.5">
          {cats.map(cat => (
            <label key={cat.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-panel-hover rounded px-1.5 py-1 transition-colors">
              <input
                type="checkbox"
                checked={!hidden.has(cat.id)}
                onChange={() => toggleHide(cat.id)}
                className="w-3 h-3 shrink-0"
              />
              <span className="text-panel-muted shrink-0">{CAT_ICONS[cat.id]}</span>
              <span className="text-panel-text flex-1 truncate">{cat.label}</span>
              <span className="text-panel-muted/50 tabular-nums">{formatBytes(cat.size)}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="space-y-0.5">
          {visible.map((cat, i) => {
            const barPct = cat.size / max * 100;
            const diskPct = disk?.total ? cat.size / disk.total * 100 : null;
            const color = CHART_COLORS[i % CHART_COLORS.length];
            return (
              <div
                key={cat.id}
                onClick={() => onNavigate(cat.primaryPath)}
                className="flex items-center gap-2 group cursor-pointer hover:bg-panel-hover/60 rounded px-1.5 py-[3px] -mx-1.5 transition-colors"
              >
                <span className="text-panel-muted/70 shrink-0 w-3.5">{CAT_ICONS[cat.id]}</span>
                <span className="w-28 text-xs text-panel-muted group-hover:text-panel-text truncate shrink-0 transition-colors">
                  {cat.label}
                </span>
                <div className="flex-1 h-1.5 bg-panel-surface rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barPct}%`, backgroundColor: color, opacity: 0.75 }}
                  />
                </div>
                <span className="text-xs text-panel-muted w-[96px] shrink-0 text-right tabular-nums">
                  {formatBytes(cat.size)}
                  {diskPct != null && diskPct >= 1 && (
                    <span className="opacity-40 ml-1">{diskPct.toFixed(0)}%</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ContextMenu({ x, y, menuItems, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  // Keep menu inside viewport
  const menuStyle = { position: 'fixed', left: Math.min(x, window.innerWidth - 192), top: Math.min(y, window.innerHeight - 40 * menuItems.length), zIndex: 9999 };

  return (
    <div ref={ref} style={menuStyle} className="bg-panel-surface border border-panel-border rounded shadow-xl py-1 min-w-48 text-xs select-none">
      {menuItems.map((item, i) =>
        item === '---' ? (
          <div key={i} className="border-t border-panel-border/50 my-1" />
        ) : (
          <button
            key={i}
            onClick={() => { item.action(); onClose(); }}
            disabled={item.disabled}
            className="w-full text-left px-3 py-1.5 text-panel-text hover:bg-panel-hover disabled:opacity-30 disabled:cursor-default flex items-center gap-2.5"
          >
            {item.icon && <span className="text-panel-muted w-3.5 flex-shrink-0">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && <span className="text-panel-muted/60 text-xs ml-2">{item.shortcut}</span>}
          </button>
        )
      )}
    </div>
  );
}

export default function FileExplorer() {
  // Navigation history
  const [navHistory, setNavHistory] = useState(['/']);
  const [navIdx, setNavIdx] = useState(0);
  const path = navHistory[navIdx];

  // UI state
  const [preview, setPreview] = useState(null);
  const [dirSizes, setDirSizes] = useState({});
  const [showChart, setShowChart] = useState(true);
  const [loadingDu, setLoadingDu] = useState({});
  const [newFolder, setNewFolder] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [showUrlFetch, setShowUrlFetch] = useState(false);
  const [fetchUrl, setFetchUrl] = useState('');
  const [fetchFilename, setFetchFilename] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draggingItem, setDraggingItem] = useState(null);
  const [dragOverFolder, setDragOverFolder] = useState(null);

  // Selection
  const [selected, setSelected] = useState(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState(null);

  // Clipboard
  const [clipboard, setClipboard] = useState(null); // { paths: [], mode: 'copy'|'cut' }

  // Context menu
  const [contextMenu, setContextMenu] = useState(null); // { x, y, item }

  // Editable address bar
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState('');

  const selectAllRef = useRef(null);
  const uploadRef = useRef(null);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['files', path],
    queryFn: () => client.get('/files', { params: { path } }).then(r => r.data),
  });

  // Keep select-all checkbox indeterminate state in sync
  useEffect(() => {
    if (selectAllRef.current) {
      const total = data?.items?.length ?? 0;
      selectAllRef.current.indeterminate = selected.size > 0 && selected.size < total;
    }
  }, [selected.size, data?.items?.length]);

  const deleteMutation = useMutation({
    mutationFn: (p) => client.delete('/files', { params: { path: p } }),
    onSuccess: () => { setDirSizes({}); qc.invalidateQueries({ queryKey: ['files', path] }); setConfirmDelete(null); },
  });

  const mkdirMutation = useMutation({
    mutationFn: (p) => client.post('/files/mkdir', { path: p }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['files', path] }); setShowNewFolder(false); setNewFolder(''); },
  });

  const renameMutation = useMutation({
    mutationFn: ({ from, to }) => client.post('/files/rename', { from, to }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['files', path] }); setRenaming(null); },
  });

  const moveMutation = useMutation({
    mutationFn: ({ from, to }) => client.post('/files/rename', { from, to }),
    onSuccess: () => { setDirSizes({}); qc.invalidateQueries({ queryKey: ['files', path] }); },
  });

  const copyMutation = useMutation({
    mutationFn: ({ from, to }) => client.post('/files/copy', { from, to }),
    onSuccess: () => { setDirSizes({}); qc.invalidateQueries({ queryKey: ['files', path] }); },
  });

  // --- Navigation ---
  function navigate(newPath) {
    if (newPath === path) return;
    const trimmed = newPath.replace(/\/$/, '') || '/';
    setNavHistory(prev => [...prev.slice(0, navIdx + 1), trimmed]);
    setNavIdx(idx => idx + 1);
    setPreview(null);
    setDirSizes({});
    setSelected(new Set());
    setLastSelectedPath(null);
    setContextMenu(null);
  }

  function goBack() {
    if (navIdx > 0) { setNavIdx(i => i - 1); setPreview(null); setDirSizes({}); setSelected(new Set()); }
  }

  function goForward() {
    if (navIdx < navHistory.length - 1) { setNavIdx(i => i + 1); setPreview(null); setDirSizes({}); setSelected(new Set()); }
  }

  function goUp() {
    const parts = path.replace(/\/$/, '').split('/');
    parts.pop();
    navigate(parts.join('/') || '/');
  }

  // --- Selection ---
  function handleRowClick(item, e) {
    if (renaming === item.path) return;
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(item.path)) next.delete(item.path);
        else next.add(item.path);
        return next;
      });
      setLastSelectedPath(item.path);
    } else if (e.shiftKey && lastSelectedPath) {
      const items = data?.items ?? [];
      const lastIdx = items.findIndex(i => i.path === lastSelectedPath);
      const thisIdx = items.findIndex(i => i.path === item.path);
      if (lastIdx >= 0 && thisIdx >= 0) {
        const [start, end] = lastIdx < thisIdx ? [lastIdx, thisIdx] : [thisIdx, lastIdx];
        setSelected(new Set(items.slice(start, end + 1).map(i => i.path)));
      }
    } else {
      setSelected(new Set([item.path]));
      setLastSelectedPath(item.path);
    }
  }

  function handleRowDoubleClick(item) {
    if (item.type === 'dir') navigate(item.path);
    else openFile(item.path);
  }

  function getSelectedItems() {
    return (data?.items ?? []).filter(i => selected.has(i.path));
  }

  // --- Clipboard ---
  function doCopy(items) {
    setClipboard({ paths: items.map(i => i.path), mode: 'copy' });
  }

  function doCut(items) {
    setClipboard({ paths: items.map(i => i.path), mode: 'cut' });
  }

  async function doPaste(targetDir) {
    if (!clipboard) return;
    const { paths, mode } = clipboard;
    await Promise.all(paths.map(fromPath => {
      const name = fromPath.split('/').pop();
      const toPath = `${targetDir}/${name}`.replace('//', '/');
      return mode === 'copy'
        ? copyMutation.mutateAsync({ from: fromPath, to: toPath })
        : moveMutation.mutateAsync({ from: fromPath, to: toPath });
    }));
    if (mode === 'cut') setClipboard(null);
    setDirSizes({});
    qc.invalidateQueries({ queryKey: ['files', path] });
  }

  // --- Context menu builder ---
  function buildMenuItems(targetItem) {
    const selItems = targetItem
      ? (selected.has(targetItem.path) && selected.size > 1
          ? getSelectedItems()
          : [targetItem])
      : [];
    const isMulti = selItems.length > 1;
    const single = !isMulti ? selItems[0] : null;
    const items = [];

    if (single) {
      if (single.type === 'dir') {
        items.push({ label: 'Aç', icon: <Folder size={12} />, action: () => navigate(single.path) });
      } else {
        items.push({ label: 'Görüntüle', icon: <Eye size={12} />, action: () => openFile(single.path) });
        items.push({ label: 'İndir', icon: <Download size={12} />, action: () => downloadFile(single.path) });
      }
      items.push({ label: 'tar.gz İndir', icon: <Archive size={12} />, action: () => downloadTar(single.path) });
      items.push('---');
    }

    if (selItems.length > 0) {
      items.push({ label: isMulti ? `Kopyala (${selItems.length})` : 'Kopyala', icon: <Copy size={12} />, action: () => doCopy(selItems), shortcut: 'Ctrl+C' });
      items.push({ label: isMulti ? `Kes (${selItems.length})` : 'Kes', icon: <Scissors size={12} />, action: () => doCut(selItems), shortcut: 'Ctrl+X' });
      items.push('---');
    }

    const pasteTarget = (single?.type === 'dir') ? single.path : path;
    if (clipboard) {
      items.push({
        label: `Yapıştır${clipboard.mode === 'cut' ? ' (taşı)' : ' (kopyala)'}`,
        icon: <Clipboard size={12} />,
        action: () => doPaste(pasteTarget),
        shortcut: 'Ctrl+V',
      });
      items.push('---');
    }

    if (selItems.length === 0) {
      items.push({ label: 'Yeni Klasör', icon: <FolderPlus size={12} />, action: () => setShowNewFolder(true) });
    } else {
      if (single) {
        items.push({ label: 'Yeniden Adlandır', icon: <Pencil size={12} />, action: () => startRename(single), shortcut: 'F2' });
      }
      items.push({
        label: isMulti ? `Sil (${selItems.length})` : 'Sil',
        icon: <Trash2 size={12} />,
        action: () => { selItems.forEach(i => deleteMutation.mutate(i.path)); setSelected(new Set()); },
        shortcut: 'Del',
      });
    }

    return items;
  }

  function handleContextMenu(e, item) {
    e.preventDefault();
    e.stopPropagation();
    if (item && !selected.has(item.path)) {
      setSelected(new Set([item.path]));
      setLastSelectedPath(item.path);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, item: item ?? null });
  }

  // --- Keyboard shortcuts (using ref to avoid stale closures) ---
  const stateRef = useRef({});
  stateRef.current = { selected, clipboard, path, data, renaming };

  useEffect(() => {
    function onKey(e) {
      const { selected, clipboard, path, data, renaming } = stateRef.current;
      if (renaming) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const selItems = (data?.items ?? []).filter(i => selected.has(i.path));

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'a') { e.preventDefault(); setSelected(new Set((data?.items ?? []).map(i => i.path))); return; }
        if (e.key === 'c') { e.preventDefault(); if (selItems.length) { setClipboard({ paths: selItems.map(i => i.path), mode: 'copy' }); } return; }
        if (e.key === 'x') { e.preventDefault(); if (selItems.length) { setClipboard({ paths: selItems.map(i => i.path), mode: 'cut' }); } return; }
        if (e.key === 'v') { e.preventDefault(); if (clipboard) doPaste(path); return; }
      }
      if (e.key === 'F2') { e.preventDefault(); if (selItems.length === 1) startRename(selItems[0]); return; }
      if (e.key === 'Delete') { e.preventDefault(); selItems.forEach(i => deleteMutation.mutate(i.path)); setSelected(new Set()); return; }
      if (e.key === 'Backspace') { e.preventDefault(); goUp(); return; }
      if (e.key === 'Escape') { setSelected(new Set()); setContextMenu(null); return; }
      if (e.key === 'Enter' && selItems.length === 1) {
        e.preventDefault();
        if (selItems[0].type === 'dir') navigate(selItems[0].path);
        else openFile(selItems[0].path);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function calcDirSize(dirPath) {
    setLoadingDu(s => ({ ...s, [dirPath]: true }));
    try {
      const res = await client.get('/files/du', { params: { path: dirPath } });
      setDirSizes(s => ({ ...s, [dirPath]: res.data.size }));
    } catch {
      setDirSizes(s => ({ ...s, [dirPath]: 0 }));
    } finally {
      setLoadingDu(s => ({ ...s, [dirPath]: false }));
    }
  }

  useEffect(() => {
    if (!data?.items) return;
    data.items.filter(i => i.type === 'dir').forEach(i => calcDirSize(i.path));
  }, [data]);

  async function openFile(filePath) {
    try {
      const res = await client.get('/files/content', { params: { path: filePath } });
      setPreview({ path: filePath, content: res.data.content });
    } catch (err) {
      setPreview({ path: filePath, content: `Error: ${err.response?.data?.error || err.message}` });
    }
  }

  function downloadFile(filePath) {
    const link = document.createElement('a');
    link.href = `/api/files/download?path=${encodeURIComponent(filePath)}`;
    link.download = filePath.split('/').pop();
    link.click();
  }

  function downloadTar(targetPath) {
    const name = targetPath.split('/').pop() || 'archive';
    const link = document.createElement('a');
    link.href = `/api/files/download-tar?path=${encodeURIComponent(targetPath)}`;
    link.download = `${name}.tar.gz`;
    link.click();
  }

  async function uploadFiles(files) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('path', path);
      for (const file of files) form.append('file', file);
      await client.post('/files/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDirSizes({});
      refetch();
    } finally {
      setUploading(false);
    }
  }

  async function handleUpload(e) {
    await uploadFiles(e.target.files);
    e.target.value = '';
  }

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    await uploadFiles(files);
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }, []);

  function createFolder() {
    if (!newFolder.trim()) return;
    mkdirMutation.mutate(`${path}/${newFolder}`.replace('//', '/'));
  }

  function startRename(item) {
    setRenaming(item.path);
    setRenameValue(item.name);
  }

  function commitRename() {
    if (!renameValue.trim() || !renaming) return;
    const dir = renaming.substring(0, renaming.lastIndexOf('/')) || '/';
    const to = `${dir}/${renameValue}`.replace('//', '/');
    if (to !== renaming) renameMutation.mutate({ from: renaming, to });
    else setRenaming(null);
  }

  async function handleFetchUrl() {
    if (!fetchUrl.trim()) return;
    setFetchLoading(true);
    setFetchError('');
    try {
      await client.post('/files/fetch-url', { url: fetchUrl, destDir: path, filename: fetchFilename.trim() || undefined });
      refetch();
      setShowUrlFetch(false);
      setFetchUrl('');
      setFetchFilename('');
    } catch (err) {
      setFetchError(err.response?.data?.error || err.message);
    } finally {
      setFetchLoading(false);
    }
  }

  const pathParts = path.split('/').filter(Boolean);
  const selCount = selected.size;
  const allSelected = selCount > 0 && selCount === (data?.items?.length ?? 0);

  return (
    <div className="flex flex-col md:flex-row h-full gap-0" onClick={() => { setSelected(new Set()); setContextMenu(null); }}>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          menuItems={buildMenuItems(contextMenu.item)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* File list */}
      <div
        className={`flex flex-col ${preview ? 'hidden md:flex md:w-1/2' : 'w-full'} transition-all relative`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onContextMenu={(e) => handleContextMenu(e, null)}
        onClick={e => e.stopPropagation()}
      >
        {/* OS file drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-10 bg-panel-accent/10 border-2 border-dashed border-panel-accent flex items-center justify-center pointer-events-none rounded">
            <div className="text-panel-accent text-sm font-medium flex items-center gap-2">
              <Upload size={18} /> Dosyaları buraya bırak
            </div>
          </div>
        )}

        {uploading && <div className="absolute top-0 left-0 right-0 h-0.5 bg-panel-accent animate-pulse z-20" />}

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 p-2 border-b border-panel-border bg-panel-surface">
          {/* Back / Forward / Up */}
          <button onClick={goBack} disabled={navIdx === 0} className="text-panel-muted hover:text-panel-text disabled:opacity-30 p-1 rounded hover:bg-panel-hover" title="Geri (Backspace)">
            <ArrowLeft size={13} />
          </button>
          <button onClick={goForward} disabled={navIdx >= navHistory.length - 1} className="text-panel-muted hover:text-panel-text disabled:opacity-30 p-1 rounded hover:bg-panel-hover" title="İleri">
            <ArrowRight size={13} />
          </button>
          <button onClick={goUp} disabled={path === '/'} className="text-panel-muted hover:text-panel-text disabled:opacity-30 p-1 rounded hover:bg-panel-hover" title="Üst klasör">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
          </button>

          {/* Editable address bar */}
          <div className="flex-1 min-w-0">
            {editingPath ? (
              <input
                autoFocus
                value={pathInput}
                onChange={e => setPathInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { navigate(pathInput); setEditingPath(false); }
                  if (e.key === 'Escape') setEditingPath(false);
                }}
                onBlur={() => setEditingPath(false)}
                className="w-full bg-panel-bg border border-panel-accent rounded px-2 py-0.5 text-xs text-panel-text focus:outline-none font-mono"
              />
            ) : (
              <div
                className="flex items-center gap-0.5 text-xs text-panel-muted cursor-text hover:bg-panel-hover rounded px-1.5 py-0.5 min-h-[22px]"
                onClick={() => { setEditingPath(true); setPathInput(path); }}
                title="Tıklayarak düzenle"
              >
                <button onClick={e => { e.stopPropagation(); navigate('/'); }} className="hover:text-panel-text shrink-0">/</button>
                {pathParts.map((part, i) => (
                  <React.Fragment key={i}>
                    <ChevronRight size={9} className="shrink-0 opacity-50" />
                    <button
                      onClick={e => { e.stopPropagation(); navigate('/' + pathParts.slice(0, i + 1).join('/')); }}
                      className="hover:text-panel-text truncate max-w-24"
                    >{part}</button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => { setDirSizes({}); refetch(); }} className="text-panel-muted hover:text-panel-text p-1 rounded hover:bg-panel-hover" title="Yenile"><RefreshCw size={12} /></button>
          <button onClick={() => setShowChart(v => !v)} className={`p-1 rounded hover:bg-panel-hover ${showChart ? 'text-panel-accent' : 'text-panel-muted hover:text-panel-text'}`} title="Boyut grafiği"><BarChart2 size={12} /></button>
          <button onClick={() => setShowNewFolder(v => !v)} className="text-panel-muted hover:text-panel-text p-1 rounded hover:bg-panel-hover" title="Yeni klasör"><FolderPlus size={13} /></button>
          <button onClick={() => { setShowUrlFetch(v => !v); setFetchError(''); }} className="text-panel-muted hover:text-panel-text p-1 rounded hover:bg-panel-hover" title="URL'den indir"><Link size={12} /></button>
          <button onClick={() => uploadRef.current?.click()} className="text-panel-muted hover:text-panel-text p-1 rounded hover:bg-panel-hover" title="Dosya yükle"><Upload size={12} /></button>
          <input ref={uploadRef} type="file" multiple className="hidden" onChange={handleUpload} />
        </div>

        {showNewFolder && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-panel-border bg-panel-hover">
            <input autoFocus value={newFolder} onChange={e => setNewFolder(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
              placeholder="Klasör adı"
              className="flex-1 bg-panel-bg border border-panel-border rounded px-2 py-1 text-xs text-panel-text focus:outline-none focus:border-panel-accent"
            />
            <button onClick={createFolder} className="text-xs text-panel-accent hover:underline">Oluştur</button>
            <button onClick={() => setShowNewFolder(false)} className="text-panel-muted hover:text-panel-text"><X size={12} /></button>
          </div>
        )}

        {showUrlFetch && (
          <div className="flex flex-col gap-2 px-3 py-2 border-b border-panel-border bg-panel-hover">
            <div className="flex items-center gap-2">
              <input autoFocus value={fetchUrl} onChange={e => setFetchUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleFetchUrl(); if (e.key === 'Escape') setShowUrlFetch(false); }}
                placeholder="https://example.com/file.tar.gz"
                className="flex-1 bg-panel-bg border border-panel-border rounded px-2 py-1 text-xs text-panel-text focus:outline-none focus:border-panel-accent"
              />
              <input value={fetchFilename} onChange={e => setFetchFilename(e.target.value)}
                placeholder="dosya adı (opsiyonel)"
                className="w-36 bg-panel-bg border border-panel-border rounded px-2 py-1 text-xs text-panel-text focus:outline-none focus:border-panel-accent"
              />
              <button onClick={handleFetchUrl} disabled={fetchLoading || !fetchUrl.trim()} className="text-xs text-panel-accent hover:underline disabled:opacity-40">
                {fetchLoading ? 'İndiriliyor...' : 'İndir'}
              </button>
              <button onClick={() => { setShowUrlFetch(false); setFetchError(''); }} className="text-panel-muted hover:text-panel-text"><X size={12} /></button>
            </div>
            {fetchError && <p className="text-xs text-panel-red">{fetchError}</p>}
          </div>
        )}

        {showChart && <DiskOverview onNavigate={navigate} />}

        {/* File table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-panel-muted text-sm">Yükleniyor...</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-panel-muted border-b border-panel-border">
                  <th className="w-7 px-2 py-2">
                    <input ref={selectAllRef} type="checkbox" checked={allSelected}
                      onChange={e => setSelected(e.target.checked ? new Set((data?.items ?? []).map(i => i.path)) : new Set())}
                      className="w-3 h-3 cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-2 py-2 font-normal">Ad</th>
                  <th className="hidden sm:table-cell text-right px-3 py-2 font-normal">Boyut</th>
                  <th className="hidden sm:table-cell text-right px-3 py-2 font-normal">Değiştirilme</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {data?.items?.map(item => {
                  const isSelected = selected.has(item.path);
                  const isCut = clipboard?.mode === 'cut' && clipboard.paths.includes(item.path);
                  const isDragTarget = dragOverFolder === item.path;
                  return (
                    <tr
                      key={item.path}
                      draggable={renaming !== item.path}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDraggingItem(item);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', item.path);
                      }}
                      onDragEnd={() => { setDraggingItem(null); setDragOverFolder(null); }}
                      onDragOver={item.type === 'dir' && draggingItem ? (e) => { e.preventDefault(); e.stopPropagation(); setDragOverFolder(item.path); } : undefined}
                      onDragLeave={item.type === 'dir' ? (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverFolder(null); } : undefined}
                      onDrop={item.type === 'dir' ? (e) => {
                        e.preventDefault(); e.stopPropagation();
                        if (draggingItem && draggingItem.path !== item.path) {
                          moveMutation.mutate({ from: draggingItem.path, to: `${item.path}/${draggingItem.name}`.replace('//', '/') });
                        }
                        setDraggingItem(null); setDragOverFolder(null);
                      } : undefined}
                      onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey) handleRowClick(item, e); }}
                      onContextMenu={(e) => handleContextMenu(e, item)}
                      className={`border-b border-panel-border/50 group cursor-default select-none
                        ${isSelected ? 'bg-panel-accent/10' : 'hover:bg-panel-hover'}
                        ${isDragTarget ? 'outline outline-1 outline-panel-accent bg-panel-accent/15' : ''}
                        ${draggingItem?.path === item.path ? 'opacity-40' : ''}
                        ${isCut ? 'opacity-50' : ''}
                      `}
                    >
                      <td className="w-7 px-2 py-1.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelected(prev => {
                              const next = new Set(prev);
                              if (next.has(item.path)) next.delete(item.path);
                              else next.add(item.path);
                              return next;
                            });
                            setLastSelectedPath(item.path);
                          }}
                          className={`w-3 h-3 cursor-pointer ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        {renaming === item.path ? (
                          <div className="flex items-center gap-1">
                            <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); }}
                              className="flex-1 bg-panel-bg border border-panel-accent rounded px-1.5 py-0.5 text-xs text-panel-text focus:outline-none"
                            />
                            <button onClick={commitRename} className="p-0.5 text-panel-accent"><Check size={11} /></button>
                            <button onClick={() => setRenaming(null)} className="p-0.5 text-panel-muted"><X size={11} /></button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (item.type === 'dir') navigate(item.path); else openFile(item.path); }}
                            className="flex items-center gap-2 text-left hover:text-panel-accent w-full"
                          >
                            {item.type === 'dir'
                              ? <Folder size={13} className="text-panel-yellow shrink-0" />
                              : <File size={13} className="text-panel-muted shrink-0" />
                            }
                            <span className="truncate text-panel-text">{item.name}</span>
                          </button>
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-3 py-1.5 text-right text-panel-muted whitespace-nowrap">
                        {item.type === 'file'
                          ? formatBytes(item.size)
                          : dirSizes[item.path] != null
                            ? <span className="text-panel-text">{formatBytes(dirSizes[item.path])}</span>
                            : <span className="text-panel-muted/40">{loadingDu[item.path] ? '...' : '—'}</span>
                        }
                      </td>
                      <td className="hidden sm:table-cell px-3 py-1.5 text-right text-panel-muted whitespace-nowrap">
                        {item.modified ? format(new Date(item.modified), 'MMM d, HH:mm') : '—'}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                          {item.type === 'file' && (
                            <button onClick={(e) => { e.stopPropagation(); openFile(item.path); }} className="p-1 text-panel-muted hover:text-panel-cyan rounded" title="Görüntüle"><Eye size={12} /></button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); downloadTar(item.path); }} className="p-1 text-panel-muted hover:text-panel-green rounded" title="tar.gz indir"><Archive size={12} /></button>
                          {item.type === 'file' && (
                            <button onClick={(e) => { e.stopPropagation(); downloadFile(item.path); }} className="p-1 text-panel-muted hover:text-panel-accent rounded" title="İndir"><Download size={12} /></button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); startRename(item); }} className="p-1 text-panel-muted hover:text-panel-yellow rounded" title="Yeniden adlandır (F2)"><Pencil size={12} /></button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirmDelete === item.path) deleteMutation.mutate(item.path);
                              else { setConfirmDelete(item.path); setTimeout(() => setConfirmDelete(null), 3000); }
                            }}
                            className={`p-1 rounded ${confirmDelete === item.path ? 'text-white bg-panel-red' : 'text-panel-muted hover:text-panel-red'}`}
                            title="Sil (Del)"
                          ><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Status / action bar */}
        <div className="px-3 py-1.5 border-t border-panel-border/50 text-panel-muted text-xs flex items-center gap-3 min-h-[30px]">
          {selCount > 0 ? (
            <>
              <span className="text-panel-text font-medium">{selCount} öğe seçili</span>
              <button onClick={() => doCopy(getSelectedItems())} className="flex items-center gap-1 hover:text-panel-text" title="Ctrl+C"><Copy size={11} /> Kopyala</button>
              <button onClick={() => doCut(getSelectedItems())} className="flex items-center gap-1 hover:text-panel-text" title="Ctrl+X"><Scissors size={11} /> Kes</button>
              {clipboard && (
                <button onClick={() => doPaste(path)} className="flex items-center gap-1 hover:text-panel-text" title="Ctrl+V"><Clipboard size={11} /> Yapıştır</button>
              )}
              <button onClick={() => { getSelectedItems().forEach(i => deleteMutation.mutate(i.path)); setSelected(new Set()); }} className="flex items-center gap-1 hover:text-panel-red ml-auto" title="Del"><Trash2 size={11} /> Sil</button>
            </>
          ) : clipboard ? (
            <span className="flex items-center gap-1.5">
              <Clipboard size={11} />
              <span>{clipboard.paths.length} öğe {clipboard.mode === 'cut' ? 'kesildi' : 'kopyalandı'} —</span>
              <button onClick={() => doPaste(path)} className="text-panel-accent hover:underline">buraya yapıştır</button>
              <button onClick={() => setClipboard(null)} className="hover:text-panel-text ml-1"><X size={10} /></button>
            </span>
          ) : (
            <>
              <span>{data?.items?.length ?? 0} öğe</span>
              <span className="ml-auto">sürükle & bırak, sağ tık veya <button onClick={() => uploadRef.current?.click()} className="underline hover:text-panel-text">yükle</button></span>
            </>
          )}
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="w-full md:w-1/2 flex flex-col border-l border-panel-border">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-panel-border bg-panel-surface text-xs text-panel-muted">
            <span className="flex-1 truncate">{preview.path}</span>
            <button onClick={() => downloadFile(preview.path)} className="hover:text-panel-accent" title="İndir"><Download size={13} /></button>
            <button onClick={() => setPreview(null)} className="hover:text-panel-text"><X size={14} /></button>
          </div>
          <pre className="flex-1 overflow-auto p-3 text-xs text-panel-text font-mono leading-5 whitespace-pre-wrap break-all">
            {preview.content}
          </pre>
        </div>
      )}
    </div>
  );
}
