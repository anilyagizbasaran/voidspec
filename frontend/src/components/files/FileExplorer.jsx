import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../../api/client.js';
import {
  Folder, File, ChevronRight, ArrowLeft, RefreshCw,
  Download, Trash2, FolderPlus, Upload, Eye, X,
  Link, Pencil, Check, Archive, BarChart2
} from 'lucide-react';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

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

function SizeChart({ items, dirSizes }) {
  const data = items
    .map(item => ({
      name: item.name,
      bytes: item.type === 'file' ? item.size : (dirSizes[item.path] ?? null),
      type: item.type,
    }))
    .filter(d => d.bytes !== null && d.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 20);

  if (data.length < 2) return null;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-panel-surface border border-panel-border rounded px-2 py-1 text-xs text-panel-text shadow">
        <p className="font-medium truncate max-w-48">{d.name}</p>
        <p className="text-panel-muted">{formatBytes(d.bytes)}</p>
      </div>
    );
  };

  const CustomLabel = ({ x, y, width, value }) => {
    if (width < 40) return null;
    return (
      <text x={x + width - 4} y={y + 10} fill="#9ca3af" fontSize={10} textAnchor="end">
        {formatBytes(value)}
      </text>
    );
  };

  return (
    <div className="border-b border-panel-border bg-panel-bg px-3 pt-3 pb-2">
      <p className="text-xs text-panel-muted mb-2 flex items-center gap-1">
        <BarChart2 size={11} /> Boyut dağılımı
      </p>
      <ResponsiveContainer width="100%" height={Math.min(data.length * 22, 300)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickFormatter={v => v.length > 16 ? v.slice(0, 15) + '…' : v}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="bytes" radius={[0, 3, 3, 0]} label={<CustomLabel />}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function FileExplorer() {
  const [path, setPath] = useState('/');
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
  const qc = useQueryClient();
  const uploadRef = useRef(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['files', path],
    queryFn: () => client.get('/files', { params: { path } }).then(r => r.data),
  });

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

  function navigate(newPath) {
    setPath(newPath);
    setPreview(null);
    setDirSizes({});
  }

  function goUp() {
    const parts = path.replace(/\/$/, '').split('/');
    parts.pop();
    navigate(parts.join('/') || '/');
  }

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
      for (const file of files) {
        form.append('file', file);
      }
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
    await uploadFiles(files);
  }, [path]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(false);
    }
  }, []);

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
    if (to !== renaming) {
      renameMutation.mutate({ from: renaming, to });
    } else {
      setRenaming(null);
    }
  }

  async function handleFetchUrl() {
    if (!fetchUrl.trim()) return;
    setFetchLoading(true);
    setFetchError('');
    try {
      await client.post('/files/fetch-url', {
        url: fetchUrl,
        destDir: path,
        filename: fetchFilename.trim() || undefined,
      });
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

  return (
    <div className="flex flex-col md:flex-row h-full gap-0">
      {/* File list */}
      <div
        className={`flex flex-col ${preview ? 'hidden md:flex md:w-1/2' : 'w-full'} transition-all relative`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-10 bg-panel-accent/10 border-2 border-dashed border-panel-accent flex items-center justify-center pointer-events-none rounded">
            <div className="text-panel-accent text-sm font-medium flex items-center gap-2">
              <Upload size={18} />
              Dosyaları buraya bırak
            </div>
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-panel-accent animate-pulse z-20" />
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b border-panel-border bg-panel-surface">
          <button onClick={goUp} disabled={path === '/'} className="text-panel-muted hover:text-panel-text disabled:opacity-30 p-1 rounded hover:bg-panel-hover">
            <ArrowLeft size={14} />
          </button>
          <div className="flex items-center gap-1 text-xs text-panel-muted flex-1 min-w-0">
            <button onClick={() => navigate('/')} className="hover:text-panel-text">/</button>
            {pathParts.map((part, i) => (
              <React.Fragment key={i}>
                <ChevronRight size={10} />
                <button
                  onClick={() => navigate('/' + pathParts.slice(0, i + 1).join('/'))}
                  className="hover:text-panel-text truncate max-w-24"
                >{part}</button>
              </React.Fragment>
            ))}
          </div>
          <button onClick={() => { setDirSizes({}); refetch(); }} className="text-panel-muted hover:text-panel-text p-1 rounded hover:bg-panel-hover" title="Yenile">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setShowChart(v => !v)} className={`p-1 rounded hover:bg-panel-hover ${showChart ? 'text-panel-accent' : 'text-panel-muted hover:text-panel-text'}`} title="Boyut grafiği">
            <BarChart2 size={13} />
          </button>
          <button onClick={() => setShowNewFolder(v => !v)} className="text-panel-muted hover:text-panel-text p-1 rounded hover:bg-panel-hover" title="Yeni klasör">
            <FolderPlus size={14} />
          </button>
          <button
            onClick={() => { setShowUrlFetch(v => !v); setFetchError(''); }}
            className="text-panel-muted hover:text-panel-text p-1 rounded hover:bg-panel-hover"
            title="URL'den indir"
          >
            <Link size={13} />
          </button>
          <button onClick={() => uploadRef.current?.click()} className="text-panel-muted hover:text-panel-text p-1 rounded hover:bg-panel-hover" title="Dosya yükle">
            <Upload size={13} />
          </button>
          <input ref={uploadRef} type="file" multiple className="hidden" onChange={handleUpload} />
        </div>

        {showNewFolder && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-panel-border bg-panel-hover">
            <input
              autoFocus
              value={newFolder}
              onChange={e => setNewFolder(e.target.value)}
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
              <input
                autoFocus
                value={fetchUrl}
                onChange={e => setFetchUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleFetchUrl(); if (e.key === 'Escape') setShowUrlFetch(false); }}
                placeholder="https://example.com/file.tar.gz"
                className="flex-1 bg-panel-bg border border-panel-border rounded px-2 py-1 text-xs text-panel-text focus:outline-none focus:border-panel-accent"
              />
              <input
                value={fetchFilename}
                onChange={e => setFetchFilename(e.target.value)}
                placeholder="dosya adı (opsiyonel)"
                className="w-36 bg-panel-bg border border-panel-border rounded px-2 py-1 text-xs text-panel-text focus:outline-none focus:border-panel-accent"
              />
              <button
                onClick={handleFetchUrl}
                disabled={fetchLoading || !fetchUrl.trim()}
                className="text-xs text-panel-accent hover:underline disabled:opacity-40"
              >
                {fetchLoading ? 'İndiriliyor...' : 'İndir'}
              </button>
              <button onClick={() => { setShowUrlFetch(false); setFetchError(''); }} className="text-panel-muted hover:text-panel-text"><X size={12} /></button>
            </div>
            {fetchError && <p className="text-xs text-panel-red">{fetchError}</p>}
          </div>
        )}

        {/* Size chart */}
        {showChart && data?.items && (
          <SizeChart items={data.items} dirSizes={dirSizes} />
        )}

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-panel-muted text-sm">Yükleniyor...</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-panel-muted border-b border-panel-border">
                  <th className="text-left px-3 py-2 font-normal">Ad</th>
                  <th className="hidden sm:table-cell text-right px-3 py-2 font-normal">Boyut</th>
                  <th className="hidden sm:table-cell text-right px-3 py-2 font-normal">Değiştirilme</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {data?.items?.map(item => (
                  <tr
                    key={item.path}
                    className="border-b border-panel-border/50 hover:bg-panel-hover group"
                  >
                    <td className="px-3 py-1.5">
                      {renaming === item.path ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); }}
                            className="flex-1 bg-panel-bg border border-panel-accent rounded px-1.5 py-0.5 text-xs text-panel-text focus:outline-none"
                          />
                          <button onClick={commitRename} className="p-0.5 text-panel-accent"><Check size={11} /></button>
                          <button onClick={() => setRenaming(null)} className="p-0.5 text-panel-muted"><X size={11} /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => item.type === 'dir' ? navigate(item.path) : openFile(item.path)}
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
                          : <span className="text-panel-muted/40 text-xs">{loadingDu[item.path] ? '...' : '—'}</span>
                      }
                    </td>
                    <td className="hidden sm:table-cell px-3 py-1.5 text-right text-panel-muted whitespace-nowrap">
                      {item.modified ? format(new Date(item.modified), 'MMM d, HH:mm') : '—'}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        {item.type === 'file' && (
                          <button onClick={() => openFile(item.path)} className="p-1 text-panel-muted hover:text-panel-cyan rounded" title="Görüntüle"><Eye size={12} /></button>
                        )}
                        <button onClick={() => downloadTar(item.path)} className="p-1 text-panel-muted hover:text-panel-green rounded" title="tar.gz indir"><Archive size={12} /></button>
                        {item.type === 'file' && (
                          <button onClick={() => downloadFile(item.path)} className="p-1 text-panel-muted hover:text-panel-accent rounded" title="İndir"><Download size={12} /></button>
                        )}
                        <button onClick={() => startRename(item)} className="p-1 text-panel-muted hover:text-panel-yellow rounded" title="Yeniden adlandır"><Pencil size={12} /></button>
                        <button
                          onClick={() => {
                            if (confirmDelete === item.path) { deleteMutation.mutate(item.path); }
                            else { setConfirmDelete(item.path); setTimeout(() => setConfirmDelete(null), 3000); }
                          }}
                          className={`p-1 rounded ${confirmDelete === item.path ? 'text-white bg-panel-red' : 'text-panel-muted hover:text-panel-red'}`}
                          title="Sil"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Drop hint */}
        <div className="px-3 py-1.5 border-t border-panel-border/50 text-panel-muted text-xs">
          Dosya yüklemek için sürükle & bırak veya çoklu seçim için <button onClick={() => uploadRef.current?.click()} className="underline hover:text-panel-text">tıkla</button>
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
