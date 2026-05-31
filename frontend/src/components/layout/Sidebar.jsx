import React from 'react';
import { LayoutDashboard, Terminal, FolderOpen, Container, Activity, Server, Clock, Shield, Users, Package } from 'lucide-react';
import { useStore } from '../../store/useStore.js';

const navItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
  { id: 'terminal', icon: Terminal, label: 'Terminal' },
  { id: 'files', icon: FolderOpen, label: 'Files' },
  { id: 'docker', icon: Container, label: 'Docker' },
  { id: 'processes', icon: Activity, label: 'Processes' },
  { id: 'services', icon: Server, label: 'Services' },
  { id: 'cron', icon: Clock, label: 'Cron' },
  { id: 'firewall', icon: Shield, label: 'Firewall' },
  { id: 'users', icon: Users, label: 'Users' },
  { id: 'packages', icon: Package, label: 'Packages' },
];

export default function Sidebar() {
  const { activeTab, setActiveTab } = useStore();

  return (
    <>
      {/* Desktop: left sidebar */}
      <aside className="hidden md:flex w-14 bg-panel-surface border-r border-panel-border flex-col items-center py-4 gap-1 shrink-0">
        <div className="mb-4">
          <Terminal size={20} className="text-panel-cyan" />
        </div>
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            title={label}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors group relative ${
              activeTab === id
                ? 'bg-panel-accent/20 text-panel-accent'
                : 'text-panel-muted hover:text-panel-text hover:bg-panel-hover'
            }`}
          >
            <Icon size={18} />
            <span className="absolute left-14 bg-panel-surface border border-panel-border text-panel-text text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
              {label}
            </span>
          </button>
        ))}
      </aside>

      {/* Mobile: bottom nav bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-panel-surface border-t border-panel-border flex items-center justify-around h-14 px-2">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              activeTab === id
                ? 'text-panel-accent'
                : 'text-panel-muted'
            }`}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
