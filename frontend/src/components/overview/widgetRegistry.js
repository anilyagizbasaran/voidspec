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

export const WIDGET_REGISTRY = {
  cpu:          { label: 'CPU',               description: 'Anlık kullanım + sparkline trend göstergesi',      icon: Cpu,         color: '#3fb950', component: WidgetCpu,          defaultPos: { x: 0, y: 1  }, defaultLayout: { w: 3,  h: 4, minW: 2,  maxW: 6,  minH: 3, maxH: 8  } },
  memory:       { label: 'Memory',            description: 'RAM kullanımı + geçmiş trend grafiği',             icon: MemoryStick, color: '#39c5cf', component: WidgetMemory,       defaultPos: { x: 3, y: 1  }, defaultLayout: { w: 3,  h: 4, minW: 2,  maxW: 6,  minH: 3, maxH: 8  } },
  disk:         { label: 'Disk',              description: 'Ana disk doluluk oranı + trend',                   icon: HardDrive,   color: '#58a6ff', component: WidgetDisk,         defaultPos: { x: 6, y: 1  }, defaultLayout: { w: 3,  h: 4, minW: 2,  maxW: 6,  minH: 3, maxH: 8  } },
  network:      { label: 'Network',           description: 'Anlık RX/TX bandwidth + geçmiş',                  icon: Network,     color: '#d29922', component: WidgetNetwork,      defaultPos: { x: 9, y: 1  }, defaultLayout: { w: 3,  h: 4, minW: 2,  maxW: 6,  minH: 3, maxH: 8  } },
  firewall:     { label: 'Firewall',          description: 'UFW durumu ve aktif kural sayısı',                 icon: Shield,      color: '#f85149', component: WidgetFirewall,     defaultPos: { x: 0, y: 5  }, defaultLayout: { w: 3,  h: 2, minW: 2,  maxW: 6,  minH: 2, maxH: 4  } },
  docker:       { label: 'Docker',            description: 'Çalışan / toplam container özeti',                 icon: Container,   color: '#58a6ff', component: WidgetDocker,       defaultPos: { x: 3, y: 5  }, defaultLayout: { w: 3,  h: 2, minW: 2,  maxW: 6,  minH: 2, maxH: 4  } },
  services:     { label: 'Services',          description: 'Systemd servis durumu özeti',                      icon: Activity,    color: '#3fb950', component: WidgetServices,     defaultPos: { x: 6, y: 5  }, defaultLayout: { w: 3,  h: 2, minW: 2,  maxW: 6,  minH: 2, maxH: 4  } },
  processes:    { label: 'Processes',         description: 'Toplam, çalışan ve uyuyan süreç sayısı',           icon: List,        color: '#7d8590', component: WidgetProcesses,    defaultPos: { x: 9, y: 5  }, defaultLayout: { w: 3,  h: 2, minW: 2,  maxW: 6,  minH: 2, maxH: 4  } },
  topprocs:     { label: 'Top Processes',     description: 'CPU/RAM tüketen süreç listesi, sıralama seçimi',   icon: Activity,    color: '#3fb950', component: WidgetTopProcesses, defaultPos: { x: 0, y: 7  }, defaultLayout: { w: 6,  h: 6, minW: 3,  maxW: 12, minH: 4, maxH: 12 } },
  recentlogs:   { label: 'Recent Logs',       description: 'Son sistem hataları ve uyarıları',                 icon: Clock,       color: '#d29922', component: WidgetRecentLogs,   defaultPos: { x: 6, y: 7  }, defaultLayout: { w: 6,  h: 6, minW: 3,  maxW: 12, minH: 4, maxH: 12 } },
  cpuramchart:  { label: 'CPU & RAM Grafiği', description: '60 örneklik CPU ve RAM zaman serisi grafiği',      icon: TrendingUp,  color: '#3fb950', component: WidgetCpuRamChart,  defaultPos: { x: 0, y: 13 }, defaultLayout: { w: 6,  h: 5, minW: 4,  maxW: 12, minH: 4, maxH: 10 } },
  networkchart: { label: 'Network Grafiği',   description: 'RX/TX bandwidth geçmişi grafiği',                  icon: TrendingUp,  color: '#d29922', component: WidgetNetworkChart, defaultPos: { x: 6, y: 13 }, defaultLayout: { w: 6,  h: 5, minW: 4,  maxW: 12, minH: 4, maxH: 10 } },
  dockerlist:   { label: 'Docker Listesi',    description: 'Container\'lar + start/stop/restart kontrolleri',  icon: Container,   color: '#58a6ff', component: WidgetDockerList,   defaultPos: { x: 0, y: 18 }, defaultLayout: { w: 6,  h: 6, minW: 3,  maxW: 12, minH: 4, maxH: 12 } },
  disklist:     { label: 'Disk Listesi',      description: 'Tüm disk bölümleri ve doluluk oranları',           icon: HardDrive,   color: '#58a6ff', component: WidgetDiskList,     defaultPos: { x: 6, y: 18 }, defaultLayout: { w: 6,  h: 6, minW: 3,  maxW: 12, minH: 4, maxH: 12 } },
  diskio:       { label: 'Disk I/O',          description: 'Okuma/yazma hızı zaman serisi grafiği',            icon: HardDrive,   color: '#3fb950', component: WidgetDiskIO,       defaultPos: { x: 0, y: 24 }, defaultLayout: { w: 6,  h: 5, minW: 4,  maxW: 12, minH: 4, maxH: 10 } },
  cpucores:     { label: 'Per-Core CPU',      description: 'Her CPU çekirdeğinin anlık yük grafiği',           icon: Layers,      color: '#3fb950', component: WidgetCpuCores,     defaultPos: { x: 6, y: 24 }, defaultLayout: { w: 6,  h: 5, minW: 3,  maxW: 12, minH: 3, maxH: 10 } },
  swap:         { label: 'Swap',              description: 'Swap bellek kullanımı ve trend',                   icon: Database,    color: '#d29922', component: WidgetSwap,         defaultPos: { x: 0, y: 29 }, defaultLayout: { w: 3,  h: 4, minW: 2,  maxW: 6,  minH: 3, maxH: 8  } },
  ports:        { label: 'Dinlenen Portlar',  description: 'Aktif TCP/UDP portları ve hangi servis dinliyor',  icon: Network,     color: '#58a6ff', component: WidgetPorts,        defaultPos: { x: 3, y: 29 }, defaultLayout: { w: 9,  h: 6, minW: 3,  maxW: 12, minH: 4, maxH: 12 } },
};

export const DEFAULT_LAYOUT = Object.entries(WIDGET_REGISTRY).map(([id, cfg]) => ({
  i: id, x: cfg.defaultPos.x, y: cfg.defaultPos.y, ...cfg.defaultLayout,
}));

export const DEFAULT_VISIBLE = [
  'cpu', 'memory', 'disk', 'network',
  'firewall', 'docker', 'services', 'processes',
  'topprocs', 'recentlogs',
];
