import React, { useState } from 'react';
import { useContainers, useImages, useImageAction } from '../../hooks/useDocker.js';
import ContainerCard from './ContainerCard.jsx';
import { RefreshCw, Download, Trash2, Package } from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function ContainerList() {
  const { data: containers, isLoading: cLoading, refetch: refetchC } = useContainers();
  const { data: images, isLoading: iLoading, refetch: refetchI } = useImages();
  const { mutate: imageAction, isPending } = useImageAction();
  const [pullImage, setPullImage] = useState('');
  const [tab, setTab] = useState('containers');
  const [pulling, setPulling] = useState(false);

  const running = containers?.filter(c => c.state === 'running').length || 0;

  async function handlePull() {
    if (!pullImage.trim()) return;
    setPulling(true);
    imageAction({ action: 'pull', image: pullImage.trim() }, {
      onSettled: () => { setPulling(false); setPullImage(''); refetchI(); },
    });
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setTab('containers')}
          className={`text-sm px-3 py-1.5 rounded ${tab === 'containers' ? 'bg-panel-accent/20 text-panel-accent' : 'text-panel-muted hover:text-panel-text'}`}
        >
          Containers
          {containers && <span className="ml-2 text-xs bg-panel-hover px-1.5 py-0.5 rounded-full">{containers.length}</span>}
          {running > 0 && <span className="ml-1 text-xs bg-panel-green/20 text-panel-green px-1.5 py-0.5 rounded-full">{running} running</span>}
        </button>
        <button
          onClick={() => setTab('images')}
          className={`text-sm px-3 py-1.5 rounded ${tab === 'images' ? 'bg-panel-accent/20 text-panel-accent' : 'text-panel-muted hover:text-panel-text'}`}
        >
          Images
          {images && <span className="ml-2 text-xs bg-panel-hover px-1.5 py-0.5 rounded-full">{images.length}</span>}
        </button>
        <button onClick={() => { refetchC(); refetchI(); }} className="ml-auto text-panel-muted hover:text-panel-text">
          <RefreshCw size={14} />
        </button>
      </div>

      {tab === 'containers' && (
        cLoading ? (
          <div className="text-panel-muted text-sm">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {containers?.map(c => <ContainerCard key={c.id} container={c} />)}
            {!containers?.length && <p className="text-panel-muted text-sm col-span-2">No containers found.</p>}
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
              {pulling ? 'Pulling...' : 'Pull'}
            </button>
          </div>

          {iLoading ? <div className="text-panel-muted text-sm">Loading...</div> : (
            <div className="flex flex-col gap-2">
              {images?.map(img => (
                <div key={img.id} className="bg-panel-surface border border-panel-border rounded-xl p-3 flex items-center gap-3">
                  <Package size={14} className="text-panel-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-panel-text truncate">{img.tags?.[0] || '<none>'}</div>
                    <div className="text-xs text-panel-muted">{img.shortId} · {formatBytes(img.size)}</div>
                  </div>
                  <button onClick={() => imageAction({ action: 'remove', id: img.id })}
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
