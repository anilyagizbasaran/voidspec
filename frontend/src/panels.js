import { lazy } from 'react';
import {
  LayoutDashboard, Terminal, FolderOpen, Container, Activity,
  Server, Clock, Shield, Package, ScrollText, History,
} from 'lucide-react';

// Panellerin tek kaynağı: hem sidebar navigasyonu hem de router burayı kullanır.
// Her panel React.lazy ile ayrı bir chunk'a çıkıyor — eskiden xterm, recharts ve
// react-grid-layout dahil her şey tek bundle'da ilk açılışta indiriliyordu.
export const PANELS = [
  {
    id: 'dashboard',
    label: 'Overview',
    icon: LayoutDashboard,
    Component: lazy(() => import('./components/overview/OverviewGrid.jsx')),
  },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: Terminal,
    Component: lazy(() => import('./components/terminal/TerminalPanel.jsx')),
  },
  {
    id: 'files',
    label: 'Files',
    icon: FolderOpen,
    wrapperClass: 'flex-1 min-h-0 overflow-hidden h-full',
    Component: lazy(() => import('./components/files/FileExplorer.jsx')),
  },
  {
    id: 'docker',
    label: 'Docker',
    icon: Container,
    wrapperClass: 'p-4 overflow-auto h-full',
    Component: lazy(() => import('./components/docker/ContainerList.jsx')),
  },
  {
    id: 'processes',
    label: 'Processes',
    icon: Activity,
    Component: lazy(() => import('./components/processes/ProcessList.jsx')),
  },
  {
    id: 'services',
    label: 'Services',
    icon: Server,
    Component: lazy(() => import('./components/services/ServiceList.jsx')),
  },
  {
    id: 'cron',
    label: 'Cron',
    icon: Clock,
    Component: lazy(() => import('./components/cron/CronList.jsx')),
  },
  {
    id: 'firewall',
    label: 'Firewall',
    icon: Shield,
    Component: lazy(() => import('./components/firewall/FirewallPanel.jsx')),
  },
  {
    id: 'packages',
    label: 'Packages',
    icon: Package,
    Component: lazy(() => import('./components/packages/PackagePanel.jsx')),
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: ScrollText,
    Component: lazy(() => import('./components/logs/LogsPanel.jsx')),
  },
  {
    id: 'loginhistory',
    label: 'Giriş Geçmişi',
    icon: History,
    Component: lazy(() => import('./components/security/LoginHistory.jsx')),
  },
];

export const DEFAULT_PANEL = 'dashboard';

export const PANEL_IDS = PANELS.map(p => p.id);

export function findPanel(id) {
  return PANELS.find(p => p.id === id) || null;
}
