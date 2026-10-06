import React, { useMemo, useState } from 'react';
import {
  useContainers, useImages, useImageAction,
  useDockerGroups, useGroupMutation, useGroupAction,
} from '../../hooks/useDocker.js';
import ContainerCard from './ContainerCard.jsx';
import { toast } from '../ui/Toast.jsx';
import {
  RefreshCw, Download, Trash2, Package, ChevronRight, Play, Square, RotateCcw,
  FolderPlus, Pencil, Search, X, Check,
} from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const COLLAPSE_KEY = 'sp-docker-collapsed-v1';

function loadCollapsed() {
  try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || []); } catch { return new Set(); }
}

function saveCollapsed(set) {
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...set])); } catch { /* yoksay */ }
}

// Gruplama: önce kullanıcının oluşturduğu gruplar (oluşturma sırasıyla), sonra
// compose projeleri (alfabetik), en sonda compose dışında çalışanlar.
function buildSections(containers, groupState) {
  const groups = groupState?.groups || [];
  const assign = groupState?.assign || {};
  const custom = new Map(groups.map(g => [g.id, { key: `g:${g.id}`, kind: 'custom', group: g, name: g.name, items: [] }]));
  const compose = new Map();
  const loose = { key: 'none', kind: 'none', name: 'Compose dışı', items: [] };

  for (const c of containers) {
    const gid = assign[c.name];
    if (gid && custom.has(gid)) {
      custom.get(gid).items.push(c);
    } else if (c.project) {
      if (!compose.has(c.project)) compose.set(c.project, { key: `p:${c.project}`, kind: 'compose', name: c.project, items: [] });
      compose.get(c.project).items.push(c);
    } else {
      loose.items.push(c);
    }
  }

  const byName = (a, b) => a.name.localeCompare(b.name, 'tr');
  for (const s of [...custom.values(), ...compose.values(), loose]) s.items.sort(byName);
  return [
    ...custom.values(),
    ...[...compose.values()].sort(byName),
    ...(loose.items.length ? [loose] : []),
  ];
}

function GroupNameInput({ initial = '', placeholder, onSubmit, onCancel, busy }) {
  const [value, setValue] = useState(initial);
  return (
    <form
      onSubmit={e => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()); }}
      className="flex items-center gap-1.5"
    >
      <input
        autoFocus
        value={value}
        maxLength={40}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && onCancel()}
        placeholder={placeholder}
        aria-label="Grup adı"
        className="w-44 bg-panel-bg border border-panel-border rounded px-2.5 py-1 text-sm text-panel-text focus:outline-none focus:border-panel-accent"
      />
      <button type="submit" disabled={busy || !value.trim()} title="Kaydet"
        className="p-1.5 rounded text-panel-accent hover:bg-panel-accent/10 disabled:opacity-40">
        <Check size={14} />
      </button>
      <button type="button" onClick={onCancel} title="Vazgeç"
        className="p-1.5 rounded text-panel-muted hover:text-panel-text hover:bg-panel-hover">
        <X size={14} />
      </button>
    </form>
  );
}

function GroupSection({ section, collapsed, onToggle, groupState, onAssign }) {
  const groupMut = useGroupMutation();
  const groupAction = useGroupAction();
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { items } = section;
  const running = items.filter(c => c.state === 'running').length;
  const canStart = items.some(c => c.state !== 'running');
  const canStop = items.some(c => c.state === 'running' && !c.self);
  const led = !items.length ? 'led-off' : running === items.length ? 'led-ok' : running === 0 ? 'led-crit' : 'led-warn';

  const ACTION_DONE = { start: 'başlatıldı', stop: 'durduruldu', restart: 'yeniden başlatıldı' };

  function runAction(action) {
    groupAction.mutate({ action, containers: items }, {
      onSuccess: ({ total, failed }) => {
        if (failed.length) toast.error(`${failed.join(', ')} için işlem başarısız oldu.`, section.name);
        else toast.success(`${total} container ${ACTION_DONE[action]}.`, section.name);
      },
      onError: e => toast.error(e.message, section.name),
    });
  }

  function rename(name) {
    groupMut.mutate({ op: 'rename', id: section.group.id, name }, {
      onSuccess: () => setRenaming(false),
      onError: e => toast.error(e.response?.data?.error || e.message, 'Grup yeniden adlandırılamadı'),
    });
  }

  function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    groupMut.mutate({ op: 'delete', id: section.group.id }, {
      onSuccess: () => toast.success('Container\'lar varsayılan gruplarına döndü.', `${section.name} silindi`),
      onError: e => toast.error(e.response?.data?.error || e.message, 'Grup silinemedi'),
    });
  }

  const busy = groupAction.isPending;
  const btn = 'flex items-center gap-1.5 px-2 py-1 text-xs rounded text-panel-muted transition-colors disabled:opacity-40';

  return (
    <section className="bg-panel-surface/40 border border-panel-border rounded-md">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
        {renaming ? (
          <GroupNameInput initial={section.name} onSubmit={rename} onCancel={() => setRenaming(false)} busy={groupMut.isPending} />
        ) : (
          <button
            onClick={onToggle}
            aria-expanded={!collapsed}
            className="flex items-center gap-2 min-w-0 text-left rounded px-1 -mx-1"
          >
            <ChevronRight size={14} className={`text-panel-muted shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
            <span className="text-panel-text font-semibold text-[15px] truncate">{section.name}</span>
            {section.kind === 'compose' && <span className="text-panel-muted-2 text-xs shrink-0">compose projesi</span>}
          </button>
        )}

        <span className="flex items-center gap-1.5 text-xs text-panel-muted shrink-0">
          <span className={`led ${led}`} />
          {items.length ? `${running}/${items.length} çalışıyor` : 'Boş'}
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          {canStart && (
            <button onClick={() => runAction('start')} disabled={busy} className={`${btn} hover:text-panel-green hover:bg-panel-green/10`}>
              <Play size={12} /> Hepsini başlat
            </button>
          )}
          {canStop && (
            <>
              <button onClick={() => runAction('restart')} disabled={busy} className={`${btn} hover:text-panel-yellow hover:bg-panel-yellow/10`}>
                <RotateCcw size={12} /> Yeniden başlat
              </button>
              <button onClick={() => runAction('stop')} disabled={busy} className={`${btn} hover:text-panel-red hover:bg-panel-red/10`}>
                <Square size={12} /> Hepsini durdur
              </button>
            </>
          )}
          {section.kind === 'custom' && !renaming && (
            <>
              <span className="w-px h-4 bg-panel-border mx-1" />
              <button onClick={() => setRenaming(true)} title="Grubu yeniden adlandır" aria-label="Grubu yeniden adlandır"
                className="p-1.5 rounded text-panel-muted hover:text-panel-text hover:bg-panel-hover">
                <Pencil size={12} />
              </button>
              <button onClick={remove} title="Grubu sil"
                className={`flex items-center gap-1 p-1.5 rounded text-xs transition-colors ${confirmDelete ? 'bg-panel-red text-white' : 'text-panel-muted hover:text-panel-red hover:bg-panel-red/10'}`}>
                <Trash2 size={12} /> {confirmDelete && 'Grubu sil?'}
              </button>
            </>
          )}
        </div>
      </header>

      {!collapsed && (
        <div className="px-3 pb-3">
          {items.length ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
              {items.map(c => (
                <ContainerCard key={c.id} container={c} groups={groupState?.groups || []}
                  assignedGroupId={groupState?.assign?.[c.name] || null} onAssign={onAssign} />
              ))}
            </div>
          ) : (
            <p className="text-panel-muted text-sm py-3">
              Bu grup henüz boş. Bir container'ı buraya almak için kartındaki grup menüsünden “{section.name}” seç.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default function ContainerList() {
  const { data: containers, isLoading: cLoading, isError: cError, refetch: refetchC } = useContainers();
  const { data: images, isLoading: iLoading, isError: iError, refetch: refetchI } = useImages();
  const { data: groupState } = useDockerGroups();
  const groupMut = useGroupMutation();
  const { mutate: imageAction } = useImageAction();
  const [pullImage, setPullImage] = useState('');
  const [tab, setTab] = useState('containers');
  const [pulling, setPulling] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  const running = containers?.filter(c => c.state === 'running').length || 0;

  const sections = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const list = (containers || []).filter(c => !q
      || c.name.toLocaleLowerCase('tr').includes(q)
      || c.image.toLocaleLowerCase('tr').includes(q)
      || (c.project || '').toLocaleLowerCase('tr').includes(q));
    const all = buildSections(list, groupState);
    // Arama yaparken boş kalan grupları gizle; normalde boş özel grup görünür kalsın.
    return q ? all.filter(s => s.items.length) : all;
  }, [containers, groupState, query]);

  function toggle(key) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      saveCollapsed(next);
      return next;
    });
  }

  function createGroup(name) {
    groupMut.mutate({ op: 'create', name }, {
      onSuccess: () => { setCreating(false); toast.success('Container kartlarındaki grup menüsünden buraya taşıyabilirsin.', `${name} oluşturuldu`); },
      onError: e => toast.error(e.response?.data?.error || e.message, 'Grup oluşturulamadı'),
    });
  }

  function assign(container, groupId) {
    groupMut.mutate({ op: 'assign', container, groupId }, {
      onError: e => toast.error(e.response?.data?.error || e.message, 'Container taşınamadı'),
    });
  }

  async function handlePull() {
    if (!pullImage.trim()) return;
    setPulling(true);
    imageAction({ action: 'pull', image: pullImage.trim() }, {
      onSettled: () => { setPulling(false); setPullImage(''); refetchI(); },
    });
  }

  const tabCls = active => `text-sm px-3 py-1.5 rounded ${active ? 'bg-panel-accent/15 text-panel-accent' : 'text-panel-muted hover:text-panel-text'}`;

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setTab('containers')} className={tabCls(tab === 'containers')}>
          Container'lar
          {containers && <span className="ml-2 text-xs text-panel-muted">{running}/{containers.length} çalışıyor</span>}
        </button>
        <button onClick={() => setTab('images')} className={tabCls(tab === 'images')}>
          İmajlar
          {images && <span className="ml-2 text-xs text-panel-muted">{images.length}</span>}
        </button>

        {tab === 'containers' && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-panel-muted pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Container ara"
                aria-label="Container ara"
                className="w-48 bg-panel-bg border border-panel-border rounded pl-8 pr-2.5 py-1 text-sm text-panel-text focus:outline-none focus:border-panel-accent"
              />
            </div>
            {creating ? (
              <GroupNameInput placeholder="Grup adı, ör. WordPick" onSubmit={createGroup}
                onCancel={() => setCreating(false)} busy={groupMut.isPending} />
            ) : (
              <button onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 px-3 py-1 text-sm rounded bg-panel-accent text-panel-bg font-medium hover:bg-panel-accent/90">
                <FolderPlus size={14} /> Yeni grup
              </button>
            )}
          </div>
        )}

        <button onClick={() => { refetchC(); refetchI(); }} title="Yenile" aria-label="Yenile"
          className={`${tab === 'containers' ? '' : 'ml-auto'} p-1.5 rounded text-panel-muted hover:text-panel-text hover:bg-panel-hover`}>
          <RefreshCw size={14} />
        </button>
      </div>

      {tab === 'containers' && (
        cLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 bg-panel-surface border border-panel-border rounded-md animate-pulse" />
            ))}
          </div>
        ) : cError ? (
          <div className="text-panel-red text-sm py-8 text-center">Container listesi alınamadı. Docker servisinin çalıştığını kontrol et.</div>
        ) : !containers?.length ? (
          <p className="text-panel-muted text-sm">Bu sunucuda hiç container yok.</p>
        ) : !sections.length ? (
          <p className="text-panel-muted text-sm">“{query}” ile eşleşen container yok.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sections.map(s => (
              <GroupSection key={s.key} section={s}
                collapsed={!query && collapsed.has(s.key)}
                onToggle={() => toggle(s.key)}
                groupState={groupState} onAssign={assign} />
            ))}
          </div>
        )
      )}

      {tab === 'images' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={pullImage}
              onChange={e => setPullImage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePull()}
              placeholder="nginx:latest, ubuntu:22.04, ..."
              className="flex-1 bg-panel-bg border border-panel-border rounded px-3 py-1.5 text-sm text-panel-text focus:outline-none focus:border-panel-accent"
            />
            <button onClick={handlePull} disabled={pulling || !pullImage.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-panel-accent/20 text-panel-accent text-sm rounded hover:bg-panel-accent/30 disabled:opacity-50">
              <Download size={13} />
              {pulling ? 'İndiriliyor…' : 'İmaj indir'}
            </button>
          </div>

          {iLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-panel-surface border border-panel-border rounded-md animate-pulse" />
              ))}
            </div>
          ) : iError ? (
            <div className="text-panel-red text-sm py-4 text-center">İmaj listesi alınamadı.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {images?.map(img => (
                <div key={img.id} className="bg-panel-surface border border-panel-border rounded-md p-3 flex items-center gap-3">
                  <Package size={14} className="text-panel-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-panel-text truncate font-mono">{img.tags?.[0] || '<none>'}</div>
                    <div className="text-xs text-panel-muted">{img.shortId}, {formatBytes(img.size)}</div>
                  </div>
                  <button onClick={() => imageAction({ action: 'remove', id: img.id })} title="İmajı sil" aria-label="İmajı sil"
                    className="text-panel-muted hover:text-panel-red p-1 rounded hover:bg-panel-hover">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
