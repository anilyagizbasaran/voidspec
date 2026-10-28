import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout';
import { LayoutGrid, RotateCcw, Check, X, GripHorizontal, Undo2 } from 'lucide-react';
import { WIDGET_REGISTRY, DEFAULT_LAYOUT, DEFAULT_VISIBLE, STORAGE_KEY } from './widgetRegistry.js';
import WidgetGallery from './WidgetGallery.jsx';
import { WidgetSizeCtx } from './WidgetSizeContext.js';
import { useIsMobile } from '../../hooks/useMediaQuery.js';
import { useOpenPanel } from '../../hooks/useOpenPanel.js';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Widget'ın kendi denetimleri (düğme, arama kutusu, sıralama seçimi) tıklamayı
// kendisi işler; yalnızca bunların dışına tıklanınca ilgili panel açılır.
const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"]';

/* Measures pixel size via ResizeObserver and injects into context */
function WidgetWrapper({ Widget, editMode, link }) {
  const outerRef = useRef(null);
  const [px, setPx] = useState({ w: 0, h: 0 });
  const openPanel = useOpenPanel();
  const clickable = link && !editMode;

  function onClick(e) {
    if (!clickable || e.target.closest(INTERACTIVE)) return;
    // Metin seçerken sayfa değişmesin.
    if (window.getSelection()?.toString()) return;
    openPanel(link);
  }

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setPx({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      onClick={onClick}
      className={`w-full h-full overflow-hidden ${editMode ? 'pt-6' : ''} ${clickable ? 'cursor-pointer' : ''}`}
    >
      <WidgetSizeCtx.Provider value={px}>
        <Widget />
      </WidgetSizeCtx.Provider>
    </div>
  );
}

const AdaptiveGrid = WidthProvider(GridLayout);
const ROW_HEIGHT   = 56;
const COLS         = 12;
const MARGIN       = [8, 8];
const PADDING      = [16, 16];

/* Returns the y coordinate just below all visible items */
function bottomY(layout, visible) {
  return layout
    .filter(item => visible.includes(item.i))
    .reduce((max, item) => Math.max(max, item.y + item.h), 0);
}

/* ── Persistence ── */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const { layout, visible } = JSON.parse(raw);
      const known = new Set(Object.keys(WIDGET_REGISTRY));
      return {
        layout:  Array.isArray(layout)  ? layout.filter(i => known.has(i.i))  : DEFAULT_LAYOUT,
        visible: Array.isArray(visible) ? visible.filter(id => known.has(id)) : DEFAULT_VISIBLE,
      };
    }
  } catch {}
  return { layout: DEFAULT_LAYOUT, visible: DEFAULT_VISIBLE };
}
function persist(layout, visible) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ layout, visible })); } catch {}
}

/* Merge x/y/w/h from RGL with min/max from registry */
function mergeConstraints(rglLayout) {
  return rglLayout.map(item => {
    const reg = WIDGET_REGISTRY[item.i];
    if (!reg) return item;
    return { ...reg.defaultLayout, ...item,
      minW: reg.defaultLayout.minW, maxW: reg.defaultLayout.maxW,
      minH: reg.defaultLayout.minH, maxH: reg.defaultLayout.maxH,
    };
  });
}

/* ── Undo Toast ── */
function UndoToast({ item, onUndo, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [item, onDismiss]);

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-panel-surface-2 border border-panel-border rounded-md text-xs shadow-lg animate-fade-up">
      <span className="text-panel-muted">
        <span className="text-panel-text">{WIDGET_REGISTRY[item.id]?.label}</span> hidden
      </span>
      <button
        onClick={onUndo}
        className="flex items-center gap-1 text-panel-accent hover:text-panel-accent/80 font-medium transition-colors"
      >
        <Undo2 size={11} />
        Undo
      </button>
      <button onClick={onDismiss} className="text-panel-muted/40 hover:text-panel-muted transition-colors ml-1">
        <X size={10} />
      </button>
    </div>
  );
}

/* ── Confirm Reset Dialog ── */
function ResetConfirm({ onConfirm, onCancel }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-panel-red/10 border border-panel-red/25 rounded text-xs shadow-lg animate-fade-up">
      <span className="text-panel-muted">Reset layout?</span>
      <button onClick={onConfirm} className="text-panel-red hover:text-panel-red/80 font-medium transition-colors">Yes, reset</button>
      <button onClick={onCancel}  className="text-panel-muted hover:text-panel-text transition-colors">Cancel</button>
    </div>
  );
}

/* ── Mobil: tek sütun ──
   12 sütunluk ızgara telefonda her widget'ı ~80 px genişliğe sıkıştırıyordu.
   Dar ekranda widget'lar masaüstü yerleşimindeki sırayla (yukarıdan aşağı,
   soldan sağa) alt alta diziliyor; yükseklikleri masaüstündekiyle aynı. */
function MobileStack({ layout }) {
  const ordered = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  return (
    <div className="h-full overflow-y-auto p-3 flex flex-col gap-2">
      {ordered.map(item => {
        const reg = WIDGET_REGISTRY[item.i];
        if (!reg) return null;
        // Küçük kartlar (CPU, RAM …) tam genişlikte gereğinden uzun kalıyordu;
        // telefonda boylarını kısaltıyoruz, listeler masaüstü boyunda kalıyor.
        const full = item.h * ROW_HEIGHT + (item.h - 1) * MARGIN[1];
        const height = item.w <= 3 ? Math.min(full, 156) : full;
        return (
          <div key={item.i} className="shrink-0 overflow-hidden" style={{ height }}>
            <WidgetWrapper Widget={reg.component} editMode={false} link={reg.link} />
          </div>
        );
      })}
      {ordered.length === 0 && (
        <p className="text-sm text-panel-muted text-center py-10">
          No widgets — add some in edit mode on a larger screen.
        </p>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function OverviewGrid() {
  const isMobile = useIsMobile();
  const [state, setState]         = useState(loadState);
  const [editMode, setEditMode]   = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [undoItem, setUndoItem]   = useState(null);
  const [showReset, setShowReset] = useState(false);
  const undoTimerRef              = useRef(null);

  const visibleLayout = useMemo(
    () => state.layout.filter(item => state.visible.includes(item.i)),
    [state.layout, state.visible]
  );

  /* Layout change — only update React state, no persist */
  const handleLayoutChange = useCallback((newLayout) => {
    setState(prev => ({ ...prev, layout: mergeConstraints(newLayout) }));
  }, []);

  /* Drag/resize stop — persist */
  const handleStop = useCallback((newLayout) => {
    const merged = mergeConstraints(newLayout);
    setState(prev => { persist(merged, prev.visible); return { ...prev, layout: merged }; });
  }, []);

  /* Remove widget — with undo */
  const removeWidget = useCallback((id, e) => {
    e?.stopPropagation();
    const item = state.layout.find(l => l.i === id);
    setState(prev => {
      const next = { ...prev, visible: prev.visible.filter(v => v !== id) };
      persist(prev.layout, next.visible);
      return next;
    });
    clearTimeout(undoTimerRef.current);
    setUndoItem({ id, item });
  }, [state.layout]);

  /* Toggle from gallery */
  const toggleWidget = useCallback((id) => {
    setState(prev => {
      if (prev.visible.includes(id)) {
        // hide
        const next = { ...prev, visible: prev.visible.filter(v => v !== id) };
        persist(prev.layout, next.visible);
        clearTimeout(undoTimerRef.current);
        setUndoItem({ id, item: prev.layout.find(l => l.i === id) });
        return next;
      } else {
        // show — re-use saved position or place at bottom
        const exists = prev.layout.find(l => l.i === id);
        const newLayout = exists
          ? prev.layout
          : [...prev.layout, { i: id, x: 0, y: bottomY(prev.layout, prev.visible), ...WIDGET_REGISTRY[id].defaultLayout }];
        const newVisible = [...prev.visible, id];
        persist(newLayout, newVisible);
        return { layout: newLayout, visible: newVisible };
      }
    });
  }, []);

  /* Undo remove */
  const undoRemove = useCallback(() => {
    if (!undoItem) return;
    clearTimeout(undoTimerRef.current);
    setState(prev => {
      const exists = prev.layout.find(l => l.i === undoItem.id);
      const newLayout = exists
        ? prev.layout
        : [...prev.layout, undoItem.item ?? { i: undoItem.id, x: 0, y: bottomY(prev.layout, prev.visible), ...WIDGET_REGISTRY[undoItem.id].defaultLayout }];
      const newVisible = [...prev.visible, undoItem.id];
      persist(newLayout, newVisible);
      return { layout: newLayout, visible: newVisible };
    });
    setUndoItem(null);
  }, [undoItem]);

  const dismissUndo = useCallback(() => setUndoItem(null), []);

  /* Reset */
  const doReset = useCallback(() => {
    const next = { layout: DEFAULT_LAYOUT, visible: DEFAULT_VISIBLE };
    setState(next);
    persist(next.layout, next.visible);
    setShowReset(false);
    setEditMode(false);
    setShowGallery(false);
  }, []);

  const exitEdit = useCallback(() => {
    setEditMode(false);
    setShowGallery(false);
    setShowReset(false);
  }, []);

  // Sürükle-bırak düzenleme dokunmatik ekranda kullanışlı değil; mobilde
  // yalnızca görüntüleme.
  if (isMobile) return <MobileStack layout={visibleLayout} />;

  return (
    <div className="relative h-full flex flex-col overflow-hidden">

      {/* ── Scrollable grid area ── */}
      <div className={`flex-1 overflow-auto transition-all duration-300 ${editMode ? 'bg-panel-bg' : ''}`}>

        {/* edit mode dot-grid overlay */}
        {editMode && (
          <div className="pointer-events-none absolute inset-0 z-0 bg-dot-grid opacity-30" />
        )}

        <AdaptiveGrid
          layout={visibleLayout}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          margin={MARGIN}
          containerPadding={PADDING}
          isDraggable={editMode}
          isResizable={editMode}
          draggableHandle=".wdg-handle"
          onLayoutChange={handleLayoutChange}
          onDragStop={handleStop}
          onResizeStop={handleStop}
          useCSSTransforms
          preventCollision={false}
          compactType="vertical"
          resizeHandles={['se', 's', 'e']}
        >
          {visibleLayout.map(item => {
            const reg = WIDGET_REGISTRY[item.i];
            if (!reg) return null;
            const Widget = reg.component;
            return (
              <div
                key={item.i}
                className={`overflow-hidden transition-all duration-200 ${
                  editMode ? 'ring-1 ring-panel-accent/25 rounded-md shadow-lg shadow-black/20' : ''
                }`}
              >
                {/* drag handle — only in edit mode */}
                {editMode && (
                  <div className="wdg-handle absolute inset-x-0 top-0 h-6 z-10 flex items-center px-2 gap-1.5 cursor-grab active:cursor-grabbing bg-panel-bg/85 backdrop-blur-sm border-b border-panel-accent/10 select-none rounded-t-xl">
                    <GripHorizontal size={11} className="text-panel-muted/40 shrink-0" />
                    <span className="text-[11px] text-panel-muted/60 truncate flex-1">{reg.label}</span>
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => removeWidget(item.i, e)}
                      className="p-0.5 text-panel-muted/40 hover:text-panel-red transition-colors rounded shrink-0"
                      title="Hide"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
                <WidgetWrapper Widget={Widget} editMode={editMode} link={reg.link} />
              </div>
            );
          })}
        </AdaptiveGrid>

        {/* Empty state */}
        {visibleLayout.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-panel-muted pointer-events-none">
            <LayoutGrid size={32} className="opacity-20" />
            <p className="text-sm opacity-50">No widgets</p>
            <p className="text-xs opacity-30">Add some from the gallery below</p>
          </div>
        )}
      </div>

      {/* ── Bottom Toolbar — edit mode ── */}
      {editMode && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-panel-bg border-t border-panel-accent/20 z-10">
          {/* left: label */}
          <span className="text-[11px] text-panel-accent/80 font-medium hidden sm:block">
            Edit mode
          </span>

          <div className="flex items-center gap-2 ml-auto">
            {/* undo toast */}
            {undoItem && (
              <UndoToast item={undoItem} onUndo={undoRemove} onDismiss={dismissUndo} />
            )}

            {/* reset confirm */}
            {showReset && !showGallery && (
              <ResetConfirm onConfirm={doReset} onCancel={() => setShowReset(false)} />
            )}

            {/* Gallery button */}
            <button
              onClick={() => { setShowGallery(p => !p); setShowReset(false); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] border rounded transition-all ${
                showGallery
                  ? 'bg-panel-accent/15 border-panel-accent/40 text-panel-accent'
                  : 'bg-panel-surface border-panel-border text-panel-muted hover:text-panel-text hover:border-panel-border/80'
              }`}
            >
              <LayoutGrid size={11} />
              Widget Gallery
              <span className="ml-0.5 text-[10px] bg-panel-accent/20 text-panel-accent rounded-full px-1 py-0.5 leading-none">
                {state.visible.length}
              </span>
            </button>

            {/* Reset */}
            {!showReset && (
              <button
                onClick={() => { setShowReset(true); setShowGallery(false); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] bg-panel-surface border border-panel-border rounded-md text-panel-muted hover:text-panel-yellow hover:border-panel-yellow/30 transition-all"
              >
                <RotateCcw size={11} />
                Reset
              </button>
            )}

            {/* Done */}
            <button
              onClick={exitEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-panel-green/12 border border-panel-green/30 rounded text-panel-green hover:bg-panel-green/20 transition-all"
            >
              <Check size={11} />
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── Edit mode toggle (normal mode) ── */}
      {!editMode && (
        <button
          onClick={() => setEditMode(true)}
          title="Edit layout"
          className="absolute bottom-3 right-3 z-10 p-2 text-panel-muted/30 hover:text-panel-muted hover:bg-panel-hover rounded transition-all"
        >
          <LayoutGrid size={14} />
        </button>
      )}

      {/* ── Widget Gallery overlay ── */}
      {showGallery && editMode && (
        <WidgetGallery
          visible={state.visible}
          onToggle={toggleWidget}
          onClose={() => setShowGallery(false)}
        />
      )}
    </div>
  );
}
