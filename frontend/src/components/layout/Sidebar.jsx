import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Cpu, Menu, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { PANELS, MOBILE_PRIMARY } from '../../panels.js';

function FloatingLabel({ label, y }) {
  return (
    <div
      className="pointer-events-none fixed z-[500]"
      style={{ top: y, left: 64, transform: 'translateY(-50%)' }}
    >
      {/* Arrow */}
      <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-0 h-0
        border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent
        border-r-[6px] border-r-panel-border" />
      <span className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-0 h-0
        border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent
        border-r-[5px] border-r-panel-surface-2" />
      {/* Label */}
      <div className="px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap font-chrome
        bg-panel-surface-2 border border-panel-border text-panel-text shadow-lg">
        {label}
      </div>
    </div>
  );
}

// Masaüstü kenar çubuğu yalnızca ikonlardan oluşuyordu; hangi ikonun ne
// olduğunu görmek için her birinin üzerine gelmek gerekiyordu. Artık
// etiketli (geniş) ve ikonlu (dar) arasında geçilebiliyor, seçim hatırlanıyor.
const EXPANDED_KEY = 'sp-sidebar-expanded';

function loadExpanded() {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    if (raw !== null) return raw === '1';
  } catch { /* depolama kapalı */ }
  // İlk açılışta geniş ekranda etiketli, dar ekranda ikonlu.
  return window.innerWidth >= 1280;
}

const primaryItems = PANELS.filter(p => MOBILE_PRIMARY.includes(p.id));
const overflowItems = PANELS.filter(p => !MOBILE_PRIMARY.includes(p.id));

export default function Sidebar() {
  // Aktif panel store'da değil URL'de tutuluyor.
  const { tab: activeTab } = useParams();
  const navigate = useNavigate();
  const [tooltip, setTooltip] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [expanded, setExpanded] = useState(loadExpanded);
  const showTimer = useRef(null);

  const overflowActive = overflowItems.some(i => i.id === activeTab);

  // Panel değişince mobil menü kapansın; Esc de kapatsın.
  useEffect(() => { setMoreOpen(false); }, [activeTab]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  function toggleExpanded() {
    setExpanded(prev => {
      const next = !prev;
      try { localStorage.setItem(EXPANDED_KEY, next ? '1' : '0'); } catch { /* depolama kapalı */ }
      return next;
    });
    setTooltip(null);
  }

  function onEnter(e, label) {
    if (expanded) return;
    const rect = e.currentTarget.getBoundingClientRect();
    clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => {
      setTooltip({ label, y: rect.top + rect.height / 2 });
    }, 60);
  }

  function onLeave() {
    clearTimeout(showTimer.current);
    setTooltip(null);
  }

  return (
    <>
      {/* ── Masaüstü kenar çubuğu ── */}
      <aside
        className={`hidden md:flex flex-col shrink-0 bg-panel-surface border-r border-panel-border
          transition-[width] duration-200 ${expanded ? 'w-48' : 'w-14'}`}
      >
        {/* Logo — a rack-unit bracket, not a rounded app icon */}
        <div className={`flex items-center h-12 border-b border-panel-border shrink-0 gap-2.5 ${expanded ? 'px-3.5' : 'justify-center'}`}>
          <div className="w-7 h-7 shrink-0 rounded-md border border-panel-border-light bg-panel-surface-2 flex items-center justify-center">
            <Cpu size={13} className="text-panel-accent" />
          </div>
          {expanded && <span className="text-sm font-semibold text-panel-text truncate">ServerPanel</span>}
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 p-2 flex-1 overflow-y-auto overflow-x-hidden">
          {PANELS.map(({ id, icon: Icon, label }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => { navigate(`/${id}`); setTooltip(null); }}
                onMouseEnter={(e) => onEnter(e, label)}
                onMouseLeave={onLeave}
                title={expanded ? undefined : label}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-3 py-2.5 rounded transition-colors duration-150 w-full
                  ${expanded ? 'px-3 justify-start' : 'justify-center'}
                  ${active
                    ? 'bg-panel-accent/10 text-panel-accent'
                    : 'text-panel-muted hover:text-panel-text hover:bg-panel-hover'
                  }`}
              >
                {/* Active tick — a lit edge on the rail, not a badge */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r bg-panel-accent" />
                )}
                <Icon size={16} className="shrink-0" />
                {expanded && <span className="text-[13px] font-medium truncate">{label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Daralt / genişlet + Power LED */}
        <div className={`flex items-center border-t border-panel-border shrink-0 py-2 ${expanded ? 'px-2 justify-between' : 'flex-col gap-2'}`}>
          <button
            onClick={toggleExpanded}
            title={expanded ? 'Collapse menu' : 'Expand menu'}
            aria-label={expanded ? 'Collapse menu' : 'Expand menu'}
            className="p-2 rounded text-panel-muted hover:text-panel-text hover:bg-panel-hover transition-colors"
          >
            {expanded ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
          <span className={`led led-ok ${expanded ? 'mr-2' : 'mb-1'}`} />
        </div>
      </aside>

      {/* Floating label (yalnızca dar modda) */}
      {tooltip && <FloatingLabel label={tooltip.label} y={tooltip.y} />}

      {/* ── Mobil: tüm paneller sayfası ── */}
      {moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/50"
            onClick={() => setMoreOpen(false)}
          />
          <div
            role="dialog"
            aria-label="All panels"
            className="md:hidden fixed left-0 right-0 z-50 bottom-[calc(3.5rem+env(safe-area-inset-bottom))]
              bg-panel-surface border-t border-panel-border rounded-t-lg p-3 animate-fade-up"
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-panel-muted uppercase tracking-wide">More panels</span>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="p-2 -mr-2 text-panel-muted hover:text-panel-text"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {overflowItems.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => navigate(`/${id}`)}
                  aria-current={activeTab === id ? 'page' : undefined}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-md border transition-colors
                    ${activeTab === id
                      ? 'text-panel-accent bg-panel-accent/10 border-panel-accent/30'
                      : 'text-panel-muted border-panel-border bg-panel-bg/40 active:bg-panel-hover'}`}
                >
                  <Icon size={20} />
                  <span className="text-xs font-medium text-center leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Mobil: alt gezinme çubuğu ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-panel-surface border-t border-panel-border
          flex items-stretch h-[calc(3.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]"
      >
        {primaryItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => navigate(`/${id}`)}
            aria-current={activeTab === id ? 'page' : undefined}
            className={`relative flex flex-col items-center justify-center gap-1 flex-1 transition-colors
              ${activeTab === id ? 'text-panel-accent' : 'text-panel-muted'}`}
          >
            {activeTab === id && <span className="absolute top-0 inset-x-4 h-[2px] rounded-b bg-panel-accent" />}
            <Icon size={20} />
            <span className="text-[11px] font-medium">{label}</span>
          </button>
        ))}
        <button
          onClick={() => setMoreOpen(o => !o)}
          aria-expanded={moreOpen}
          className={`relative flex flex-col items-center justify-center gap-1 flex-1 transition-colors
            ${moreOpen || overflowActive ? 'text-panel-accent' : 'text-panel-muted'}`}
        >
          {overflowActive && !moreOpen && <span className="absolute top-0 inset-x-4 h-[2px] rounded-b bg-panel-accent" />}
          {moreOpen ? <X size={20} /> : <Menu size={20} />}
          <span className="text-[11px] font-medium truncate max-w-full px-1">
            {overflowActive ? PANELS.find(p => p.id === activeTab)?.label : 'Menu'}
          </span>
        </button>
      </nav>
    </>
  );
}
