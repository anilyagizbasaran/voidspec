import { Cpu, MemoryStick, HardDrive, Network, Shield, Container, Activity, List, Clock, TrendingUp, Database, Layers } from 'lucide-react';
import WidgetCpu          from './widgets/WidgetCpu.jsx';
import WidgetMemory       from './widgets/WidgetMemory.jsx';
import WidgetDisk         from './widgets/WidgetDisk.jsx';
import WidgetNetwork      from './widgets/WidgetNetwork.jsx';
import WidgetFirewall     from './widgets/WidgetFirewall.jsx';
import WidgetDocker       from './widgets/WidgetDocker.jsx';
import WidgetServices     from './widgets/WidgetServices.jsx';
import WidgetProcesses    from './widgets/WidgetProcesses.jsx';
import WidgetTopProcesses from './widgets/WidgetTopProcesses.jsx';
import WidgetRecentLogs   from './widgets/WidgetRecentLogs.jsx';
import WidgetCpuRamChart  from './widgets/WidgetCpuRamChart.jsx';
import WidgetNetworkChart from './widgets/WidgetNetworkChart.jsx';
import WidgetDockerList   from './widgets/WidgetDockerList.jsx';
import WidgetDiskList     from './widgets/WidgetDiskList.jsx';
import WidgetDiskIO      from './widgets/WidgetDiskIO.jsx';
import WidgetCpuCores    from './widgets/WidgetCpuCores.jsx';
import WidgetSwap        from './widgets/WidgetSwap.jsx';
import WidgetPorts       from './widgets/WidgetPorts.jsx';

export const STORAGE_KEY = 'sp-overview-v3';

// link: widget'a tıklanınca açılan panel (panels.js id'si); null = ilgili sayfa yok.
export const WIDGET_REGISTRY = {
  cpu:          { label: 'CPU',                   link: 'processes',   description: 'Live usage with a sparkline trend',      icon: Cpu,         color: '#3fcf6b', component: WidgetCpu,          defaultPos: { x: 0, y: 1  }, defaultLayout: { w: 3,  h: 4, minW: 2,  maxW: 6,  minH: 3, maxH: 8  } },
  memory:       { label: 'Memory',                link: 'processes',   description: 'RAM usage with a history trend',             icon: MemoryStick, color: '#63bfd8', component: WidgetMemory,       defaultPos: { x: 3, y: 1  }, defaultLayout: { w: 3,  h: 4, minW: 2,  maxW: 6,  minH: 3, maxH: 8  } },
  disk:         { label: 'Disk',                  link: 'files',       description: 'Root disk usage with trend',                   icon: HardDrive,   color: '#d8cfbd', component: WidgetDisk,         defaultPos: { x: 6, y: 1  }, defaultLayout: { w: 3,  h: 4, minW: 2,  maxW: 6,  minH: 3, maxH: 8  } },
  network:      { label: 'Network',               link: null,          description: 'Live RX/TX bandwidth with history',                  icon: Network,     color: '#eea53b', component: WidgetNetwork,      defaultPos: { x: 9, y: 1  }, defaultLayout: { w: 3,  h: 4, minW: 2,  maxW: 6,  minH: 3, maxH: 8  } },
  firewall:     { label: 'Firewall',              link: 'firewall',    description: 'UFW status and active rule count',                 icon: Shield,      color: '#ef5a50', component: WidgetFirewall,     defaultPos: { x: 0, y: 5  }, defaultLayout: { w: 3,  h: 2, minW: 2,  maxW: 6,  minH: 2, maxH: 4  } },
  docker:       { label: 'Docker',                link: 'docker',      description: 'Running / total containers',                 icon: Container,   color: '#d8cfbd', component: WidgetDocker,       defaultPos: { x: 3, y: 5  }, defaultLayout: { w: 3,  h: 2, minW: 2,  maxW: 6,  minH: 2, maxH: 4  } },
  services:     { label: 'Services',              link: 'services',    description: 'Systemd service status summary',                      icon: Activity,    color: '#3fcf6b', component: WidgetServices,     defaultPos: { x: 6, y: 5  }, defaultLayout: { w: 3,  h: 2, minW: 2,  maxW: 6,  minH: 2, maxH: 4  } },
  processes:    { label: 'Processes',             link: 'processes',   description: 'Total, running and sleeping processes',           icon: List,        color: '#95a0aa', component: WidgetProcesses,    defaultPos: { x: 9, y: 5  }, defaultLayout: { w: 3,  h: 2, minW: 2,  maxW: 6,  minH: 2, maxH: 4  } },
  topprocs:     { label: 'Top Processes',         link: 'processes',   description: 'Processes by CPU/RAM usage, sortable',   icon: Activity,    color: '#3fcf6b', component: WidgetTopProcesses, defaultPos: { x: 0, y: 7  }, defaultLayout: { w: 6,  h: 6, minW: 3,  maxW: 12, minH: 4, maxH: 12 } },
  recentlogs:   { label: 'Recent Logs',           link: 'logs',        description: 'Latest system errors and warnings',                 icon: Clock,       color: '#eea53b', component: WidgetRecentLogs,   defaultPos: { x: 6, y: 7  }, defaultLayout: { w: 6,  h: 6, minW: 3,  maxW: 12, minH: 4, maxH: 12 } },
  cpuramchart:  { label: 'CPU & RAM Chart',       link: 'processes',   description: 'CPU and RAM over the last 60 samples',      icon: TrendingUp,  color: '#3fcf6b', component: WidgetCpuRamChart,  defaultPos: { x: 0, y: 13 }, defaultLayout: { w: 6,  h: 5, minW: 4,  maxW: 12, minH: 4, maxH: 10 } },
  networkchart: { label: 'Network Chart',         link: null,          description: 'RX/TX bandwidth history',                  icon: TrendingUp,  color: '#eea53b', component: WidgetNetworkChart, defaultPos: { x: 6, y: 13 }, defaultLayout: { w: 6,  h: 5, minW: 4,  maxW: 12, minH: 4, maxH: 10 } },
  dockerlist:   { label: 'Docker List',           link: 'docker',      description: 'Containers with start/stop/restart controls',  icon: Container,   color: '#d8cfbd', component: WidgetDockerList,   defaultPos: { x: 0, y: 18 }, defaultLayout: { w: 6,  h: 6, minW: 3,  maxW: 12, minH: 4, maxH: 12 } },
  disklist:     { label: 'Disk List',             link: 'files',       description: 'All partitions and their usage',           icon: HardDrive,   color: '#d8cfbd', component: WidgetDiskList,     defaultPos: { x: 6, y: 18 }, defaultLayout: { w: 6,  h: 6, minW: 3,  maxW: 12, minH: 4, maxH: 12 } },
  diskio:       { label: 'Disk I/O',              link: 'files',       description: 'Read/write throughput over time',            icon: HardDrive,   color: '#3fcf6b', component: WidgetDiskIO,       defaultPos: { x: 0, y: 24 }, defaultLayout: { w: 6,  h: 5, minW: 4,  maxW: 12, minH: 4, maxH: 10 } },
  cpucores:     { label: 'Per-Core CPU',          link: 'processes',   description: 'Live load of each CPU core',           icon: Layers,      color: '#3fcf6b', component: WidgetCpuCores,     defaultPos: { x: 6, y: 24 }, defaultLayout: { w: 6,  h: 5, minW: 3,  maxW: 12, minH: 3, maxH: 10 } },
  swap:         { label: 'Swap',                  link: 'processes',   description: 'Swap usage with trend',                   icon: Database,    color: '#eea53b', component: WidgetSwap,         defaultPos: { x: 0, y: 29 }, defaultLayout: { w: 3,  h: 4, minW: 2,  maxW: 6,  minH: 3, maxH: 8  } },
  ports:        { label: 'Listening Ports',       link: 'firewall',    description: 'Open TCP/UDP ports and the listening process',  icon: Network,     color: '#d8cfbd', component: WidgetPorts,        defaultPos: { x: 3, y: 29 }, defaultLayout: { w: 9,  h: 6, minW: 3,  maxW: 12, minH: 4, maxH: 12 } },
};

export const DEFAULT_LAYOUT = Object.entries(WIDGET_REGISTRY).map(([id, cfg]) => ({
  i: id, x: cfg.defaultPos.x, y: cfg.defaultPos.y, ...cfg.defaultLayout,
}));

export const DEFAULT_VISIBLE = [
  'cpu', 'memory', 'disk', 'network',
  'firewall', 'docker', 'services', 'processes',
  'topprocs', 'recentlogs',
];
