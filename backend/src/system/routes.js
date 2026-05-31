import si from 'systeminformation';
import os from 'os';

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
        used: mem.used,
        free: mem.free,
        active: mem.active,
        buffcache: mem.buffcache,
        swap: { total: mem.swaptotal, used: mem.swapused, free: mem.swapfree },
        percent: Math.round((mem.used / mem.total) * 1000) / 10,
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
    const connections = await si.networkConnections().catch(() => []);
    const listening = connections
      .filter(c => c.state === 'LISTEN' || c.state === 'listen')
      .map(c => ({
        protocol: c.protocol,
        localAddress: c.localAddress,
        localPort: Number(c.localPort),
        pid: c.pid,
        process: c.process || '',
      }))
      .sort((a, b) => a.localPort - b.localPort);

    reply.send({ ports: listening });
  });
}
