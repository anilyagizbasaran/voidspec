import si from 'systeminformation';
import os from 'os';
import { hostNet } from '../lib/host.js';

// `ss -tulnp` çıktısını satır satır çözer:
// tcp LISTEN 0 511 0.0.0.0:8080 0.0.0.0:* users:(("docker-proxy",pid=123,fd=4))
export function parseSsOutput(raw) {
  const ports = [];
  const seen = new Set();

  for (const line of raw.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;

    const [protocol, state, , , local] = parts;
    if (protocol !== 'tcp' && protocol !== 'udp') continue;
    if (state !== 'LISTEN' && state !== 'UNCONN') continue;

    // IPv6 adresleri de var: [::]:80 → adres ve port son ':' ile ayrılır.
    const sep = local.lastIndexOf(':');
    if (sep === -1) continue;
    const localPort = Number(local.slice(sep + 1));
    if (!Number.isFinite(localPort)) continue;

    const procMatch = line.match(/users:\(\("([^"]+)",pid=(\d+)/);

    const key = `${protocol}|${local}`;
    if (seen.has(key)) continue;
    seen.add(key);

    ports.push({
      protocol,
      localAddress: local.slice(0, sep),
      localPort,
      pid: procMatch ? Number(procMatch[2]) : null,
      process: procMatch ? procMatch[1] : '',
    });
  }

  return ports.sort((a, b) => a.localPort - b.localPort || a.protocol.localeCompare(b.protocol));
}

export async function systemRoutes(fastify) {
  fastify.get('/api/system/stats', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const [cpu, mem, disk, network, diskIO] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats('*'),
      si.disksIO().catch(() => null),
    ]);

    const timeData = await si.time();
    const loadAvg = os.loadavg();

    reply.send({
      cpu: {
        load: Math.round(cpu.currentLoad * 10) / 10,
        cores: cpu.cpus?.length || 1,
        loadAvg: loadAvg.map(v => Math.round(v * 100) / 100),
        perCore: cpu.cpus?.map(c => Math.round(c.load * 10) / 10) || [],
      },
      memory: {
        total: mem.total,
        used: mem.total - mem.available,
        free: mem.free,
        available: mem.available,
        active: mem.active,
        buffcache: mem.buffcache,
        swap: { total: mem.swaptotal, used: mem.swapused, free: mem.swapfree },
        percent: Math.round(((mem.total - mem.available) / mem.total) * 1000) / 10,
      },
      disk: disk.map(d => ({
        fs: d.fs,
        mount: d.mount,
        size: d.size,
        used: d.used,
        percent: d.use,
      })),
      diskIO: diskIO ? {
        readSec: Math.round((diskIO.rBps || 0)),
        writeSec: Math.round((diskIO.wBps || 0)),
      } : null,
      network: network
        .filter(n => n.iface && !n.iface.startsWith('lo'))
        .map(n => ({
          iface: n.iface,
          rx: Math.max(0, n.rx_sec || 0),
          tx: Math.max(0, n.tx_sec || 0),
          rxTotal: n.rx_bytes,
          txTotal: n.tx_bytes,
        })),
      uptime: timeData.uptime,
    });
  });

  fastify.get('/api/system/hardware', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const [cpuInfo, cpuTemp, osInfo, netIfaces] = await Promise.all([
      si.cpu(),
      si.cpuTemperature().catch(() => ({ main: null, cores: [] })),
      si.osInfo(),
      si.networkInterfaces('*').catch(() => []),
    ]);

    const ifaces = Array.isArray(netIfaces) ? netIfaces : [netIfaces].filter(Boolean);

    reply.send({
      cpu: {
        manufacturer: cpuInfo.manufacturer,
        brand: cpuInfo.brand,
        speed: cpuInfo.speed,
        cores: cpuInfo.cores,
        physicalCores: cpuInfo.physicalCores,
        temperature: cpuTemp.main,
        coreTemps: cpuTemp.cores || [],
      },
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        kernel: osInfo.kernel,
        arch: osInfo.arch,
        hostname: osInfo.hostname,
      },
      network: ifaces
        .filter(n => !n.internal)
        .map(n => ({
          iface: n.iface,
          ip4: n.ip4,
          ip6: n.ip6,
          mac: n.mac,
          type: n.type,
          speed: n.speed,
          operstate: n.operstate,
        })),
    });
  });

  fastify.get('/api/system/ports', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    // si.networkConnections() burada işe yaramıyordu: `ss` konteyner imajında
    // yok ve olsa bile konteynerin kendi ağ namespace'ini görürdü — panel
    // sürekli boş liste gösteriyordu. Host'un ağ namespace'inden okuyoruz.
    const { stdout } = await hostNet(['ss', '-tulnp']);
    reply.send({ ports: parseSsOutput(stdout) });
  });
}
