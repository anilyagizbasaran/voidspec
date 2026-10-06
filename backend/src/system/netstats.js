import { readFile } from 'fs/promises';
import { hostNet } from '../lib/host.js';

// Backend kendi ağ namespace'inde çalışıyor; systeminformation'ın okuduğu
// /proc/net/dev yalnızca konteynerin veth ucunu gösteriyordu (yani panelin
// kendi API trafiğini). `pid: host` sayesinde init'in proc girdisine
// erişebiliyoruz — /proc/1/net/dev host'un gerçek sayaçlarını verir.
// Bilerek nsenter kullanmıyoruz: bu dosya 2 sn'de bir okunuyor, proses
// açmanın maliyeti (50-350 ms) burada kabul edilemez. Düz dosya okuması
// mikrosaniyeler sürüyor.
const NET_DEV = '/proc/1/net/dev';
const NET_ROUTE = '/proc/1/net/route';

// Köprüler, veth uçları ve loopback sayılmaz: bunların trafiği zaten fiziksel
// arayüzde bir kez daha görünür, toplarsak çift sayarız.
const VIRTUAL_RE = /^(lo|veth|br-|docker|virbr|dummy|kube|cni|flannel|tun|tap)/;

export function isVirtualIface(name) {
  return VIRTUAL_RE.test(name);
}

// /proc/net/dev satırı: "  eth0: 4009520983 13992057 0 0 0 0 0 0 2726258054 ..."
export function parseNetDev(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const iface = line.slice(0, sep).trim();
    if (!iface || isVirtualIface(iface)) continue;
    const f = line.slice(sep + 1).trim().split(/\s+/).map(Number);
    if (f.length < 16 || Number.isNaN(f[0]) || Number.isNaN(f[8])) continue;
    out.push({
      iface,
      rxTotal: f[0],
      txTotal: f[8],
      rxErrors: f[2] + f[3],
      txErrors: f[10] + f[11],
    });
  }
  return out;
}

// Varsayılan rota hangi arayüzden çıkıyorsa "uplink" odur. Toplam indirme/
// yükleme hızını yalnızca ondan hesaplıyoruz; wg0 gibi tünel arayüzlerinin
// trafiği fiziksel arayüzün içinde zaten sayılıyor.
export function parseDefaultIface(raw) {
  for (const line of raw.split('\n').slice(1)) {
    const f = line.trim().split(/\s+/);
    if (f.length > 2 && f[1] === '00000000') return f[0];
  }
  return null;
}

// Sayaçlar mutlak; hız için iki örneklem arasındaki farkı alıyoruz. Saf
// fonksiyon: önceki örneklemi parametre olarak alır, modül durumuna dokunmaz
// — böylece dosya I/O olmadan test edilebilir.
export function computeRates(sample, now, prev) {
  if (!prev) return null;
  const dt = (now - prev.ts) / 1000;
  // Çok yakın iki okuma bölmeyi patlatır / gürültü üretir. Birden fazla
  // istemci aynı anda 2 sn'de bir çektiğinde bu sık yaşanır.
  if (dt < 0.5) return null;
  return sample.map(cur => {
    const old = prev.map.get(cur.iface);
    // Sayaç sıfırlandıysa (arayüz reset / 32-bit sarma) negatif çıkar.
    const rx = old ? Math.max(0, cur.rxTotal - old.rxTotal) / dt : 0;
    const tx = old ? Math.max(0, cur.txTotal - old.txTotal) / dt : 0;
    return {
      iface: cur.iface,
      rx: Math.round(rx),
      tx: Math.round(tx),
      rxTotal: cur.rxTotal,
      txTotal: cur.txTotal,
      rxErrors: cur.rxErrors,
      txErrors: cur.txErrors,
    };
  });
}

// `network` + `networkTotal` şeklini üretir. Saf fonksiyon: sadece
// defaultIface eşleşen arayüzü toplar. defaultIface bulunamazsa (route
// okunamadı) ya da eşleşen arayüz sanal olduğu için `computed`'ta yoksa,
// TÜM arayüzleri toplamak yerine 0 döner — aksi halde wg0 gibi tünellerin
// trafiği fiziksel arayüzle birlikte iki kez sayılırdı.
export function computeTotals(computed, defaultIface) {
  const primary = defaultIface ? computed.filter(n => n.iface === defaultIface) : [];
  return {
    network: computed.map(n => ({ ...n, primary: n.iface === defaultIface })),
    networkTotal: {
      rx: primary.reduce((s, n) => s + n.rx, 0),
      tx: primary.reduce((s, n) => s + n.tx, 0),
      iface: defaultIface,
    },
  };
}

let prev = null;
let cached = { network: [], networkTotal: { rx: 0, tx: 0, iface: null } };
// Aynı hatayı her 2 sn'lik istekte tekrar loglamamak için yalnızca durum
// değiştiğinde (iyi→kötü, kötü→iyi) yazıyoruz.
let lastReadFailed = false;
let lastDefaultIfaceMissing = false;

export async function networkStats(logger = console) {
  let sample;
  let defaultIface = null;
  try {
    const [dev, route] = await Promise.all([
      readFile(NET_DEV, 'utf8'),
      readFile(NET_ROUTE, 'utf8').catch(() => ''),
    ]);
    sample = parseNetDev(dev);
    defaultIface = parseDefaultIface(route);
    if (lastReadFailed) {
      logger.warn?.('netstats: /proc/1/net/dev tekrar okunabiliyor');
      lastReadFailed = false;
    }
  } catch (err) {
    if (!lastReadFailed) {
      logger.warn?.(`netstats: /proc/1/net/dev okunamadı (${err.message}), önbellekteki son değer dönülüyor`);
      lastReadFailed = true;
    }
    return cached;
  }

  if (!defaultIface) {
    if (!lastDefaultIfaceMissing) {
      logger.warn?.('netstats: varsayılan rota arayüzü bulunamadı, networkTotal 0 dönüyor (çift sayımdan kaçınmak için tüm arayüzler toplanmıyor)');
      lastDefaultIfaceMissing = true;
    }
  } else {
    lastDefaultIfaceMissing = false;
  }

  const now = Date.now();
  const computed = computeRates(sample, now, prev);
  if (computed) {
    cached = computeTotals(computed, defaultIface);
    prev = { ts: now, map: new Map(sample.map(n => [n.iface, n])) };
  } else if (!prev) {
    prev = { ts: now, map: new Map(sample.map(n => [n.iface, n])) };
    cached = computeTotals(sample.map(n => ({ ...n, rx: 0, tx: 0 })), defaultIface);
  }
  return cached;
}

// İlk istek 0 dönmesin diye açılışta bir örneklem al.
networkStats().catch(() => {});

// Arayüz listesi/IP'leri de host ağ namespace'inden gelmeli; si.networkInterfaces()
// konteynerin 172.x adresini gösteriyordu. 30 sn'de bir çağrılan bir endpoint
// olduğu için tek nsenter çağrısının maliyeti önemsiz.
export function parseIpAddr(json) {
  let list;
  try {
    list = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter(n => n.ifname && !isVirtualIface(n.ifname))
    .map(n => {
      const addrs = Array.isArray(n.addr_info) ? n.addr_info : [];
      return {
        iface: n.ifname,
        ip4: addrs.find(a => a.family === 'inet')?.local || null,
        ip6: addrs.find(a => a.family === 'inet6' && a.scope !== 'link')?.local || null,
        mac: n.address || null,
        operstate: (n.operstate || '').toLowerCase(),
        mtu: n.mtu ?? null,
      };
    });
}

export async function hostInterfaces() {
  const { stdout, ok } = await hostNet(['ip', '-j', 'addr', 'show']);
  if (!ok) return [];
  const ifaces = parseIpAddr(stdout);
  // Link hızı /sys'te; virtio gibi sanal NIC'lerde -1 döner, o zaman gösterme.
  await Promise.all(ifaces.map(async n => {
    const raw = await readFile(`/host/sys/class/net/${n.iface}/speed`, 'utf8').catch(() => '');
    const speed = Number(raw.trim());
    n.speed = Number.isFinite(speed) && speed > 0 ? speed : null;
  }));
  return ifaces;
}
