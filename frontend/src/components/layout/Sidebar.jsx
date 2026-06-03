import React, { useState, useRef } from 'react';
import { LayoutDashboard, Terminal, FolderOpen, Container, Activity, Server, Clock, Shield, Package, ScrollText, Cpu } from 'lucide-react';
import { useStore } from '../../store/useStore.js';

const navItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Overview'  },
  { id: 'terminal',  icon: Terminal,         label: 'Terminal'  },
  { id: 'files',     icon: FolderOpen,       label: 'Files'     },
  { id: 'docker',    icon: Container,        label: 'Docker'    },
  { id: 'processes', icon: Activity,         label: 'Processes' },
  { id: 'services',  icon: Server,           label: 'Services'  },
  { id: 'cron',      icon: Clock,            label: 'Cron'      },
  { id: 'firewall',  icon: Shield,           label: 'Firewall'  },
  { id: 'packages',  icon: Package,          label: 'Packages'  },
  { id: 'logs',      icon: ScrollText,       label: 'Logs'      },
];

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
      <div className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
        bg-panel-surface-2 border border-panel-border text-panel-text shadow-lg
        animate-[fadeSlideIn_0.1s_ease-out]">
        {label}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { activeTab, setActiveTab } = useStore();
  const [tooltip, setTooltip] = useState(null);
  const showTimer = useRef(null);

  function onEnter(e, label) {
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
      {/* ── Desktop sidebar — always narrow ── */}
      <aside className="hidden md:flex flex-col w-14 shrink-0 bg-panel-surface border-r border-panel-border">

        {/* Logo */}
        <div className="flex items-center justify-center h-12 border-b border-panel-border shrink-0">
          <div className="w-7 h-7 rounded-lg bg-panel-accent/15 flex items-center justify-center">
            <Cpu size={14} className="text-panel-accent" />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 p-2 flex-1 overflow-y-auto">
          {navItems.map(({ id, icon: Icon, label }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => { setActiveTab(id); setTooltip(null); }}
                onMouseEnter={(e) => onEnter(e, label)}
                onMouseLeave={onLeave}
                className={`relative flex items-center justify-center py-2.5 rounded-lg transition-all duration-150 w-full
                  ${active
                    ? 'bg-panel-accent/10 text-panel-accent'
                    : 'text-panel-muted hover:text-panel-text hover:bg-panel-hover'
                  }`}
              >
                {/* Active dot */}
                {active && (
                  <span className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-panel-accent" />
                )}
                <Icon size={16} className="shrink-0" />
              </button>
            );
          })}
        </nav>

        {/* Bottom decoration */}
        <div className="flex items-center justify-center py-3 border-t border-panel-border shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-panel-green dot-green-glow" />
        </div>
      </aside>

      {/* Floating label */}
      {tooltip && <FloatingLabel label={tooltip.label} y={tooltip.y} />}

      {/* ── Mobile: bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-panel-surface border-t border-panel-border flex items-center justify-around h-14 px-1">
        {navItems.slice(0, 8).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors
              ${activeTab === id ? 'text-panel-accent' : 'text-panel-muted'}`}
          >
            <Icon size={18} />
            <span className="text-[9px] font-medium">{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
