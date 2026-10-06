import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNetDev, parseDefaultIface, parseIpAddr, isVirtualIface, computeRates, computeTotals } from '../src/system/netstats.js';

const NET_DEV = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 714297386 2372938    0    0    0     0          0         0 714297386 2372938    0    0    0     0       0          0
  eth0: 4009520983 13992057    1    2    0     0          0         0 2726258054 15006850    3    4    0     0       0          0
docker0:  218367      90    0    0    0     0          0         0    56000      66    0    0    0     0       0          0
br-77f97595d88b: 37538218   53702    0    0    0     0          0         0  9483758   60400    0    0    0     0       0          0
veth2620565: 38104585   43918    0    0    0     0          0         0 10501816   73812    0    0    0     0       0          0
   wg0: 12345    10    0    0    0     0          0         0  6789     8    0    0    0     0       0          0`;

test('parseNetDev sanal arayüzleri eler, sayaçları okur', () => {
  const rows = parseNetDev(NET_DEV);
  assert.deepEqual(rows.map(r => r.iface), ['eth0', 'wg0']);
  const eth = rows[0];
  assert.equal(eth.rxTotal, 4009520983);
  assert.equal(eth.txTotal, 2726258054);
  assert.equal(eth.rxErrors, 3);  // errs + drop
  assert.equal(eth.txErrors, 7);
});

test('isVirtualIface köprü/veth/loopback yakalar', () => {
  for (const n of ['lo', 'docker0', 'br-abc', 'veth123', 'virbr0']) {
    assert.equal(isVirtualIface(n), true, n);
  }
  for (const n of ['eth0', 'ens3', 'wg0', 'enp0s3']) {
    assert.equal(isVirtualIface(n), false, n);
  }
});

test('parseDefaultIface varsayılan rotanın arayüzünü bulur', () => {
  const route = `Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask
eth0\t0001A8C0\t00000000\t0001\t0\t0\t0\t00FFFFFF\t0\t0\t0
eth0\t00000000\t0101A8C0\t0003\t0\t0\t100\t00000000\t0\t0\t0`;
  assert.equal(parseDefaultIface(route), 'eth0');
  assert.equal(parseDefaultIface('Iface\tDestination\n'), null);
});

test('parseIpAddr host arayüzlerini normalize eder', () => {
  const json = JSON.stringify([
    { ifname: 'lo', address: '00:00:00:00:00:00', operstate: 'UNKNOWN', addr_info: [] },
    {
      ifname: 'eth0', address: 'aa:bb:cc:dd:ee:ff', operstate: 'UP', mtu: 1500,
      addr_info: [
        { family: 'inet', local: '161.97.155.142' },
        { family: 'inet6', scope: 'link', local: 'fe80::1' },
        { family: 'inet6', scope: 'global', local: '2a02::1' },
      ],
    },
    { ifname: 'veth123', address: 'de:ad:be:ef:00:01', operstate: 'UP', addr_info: [] },
  ]);
  const ifaces = parseIpAddr(json);
  assert.equal(ifaces.length, 1);
  assert.deepEqual(ifaces[0], {
    iface: 'eth0',
    ip4: '161.97.155.142',
    ip6: '2a02::1',   // link-local atlanır
    mac: 'aa:bb:cc:dd:ee:ff',
    operstate: 'up',
    mtu: 1500,
  });
});

test('parseIpAddr bozuk JSON ile patlamaz', () => {
  assert.deepEqual(parseIpAddr('not json'), []);
  assert.deepEqual(parseIpAddr('{}'), []);
});

test('computeRates önceki örneklem yoksa null döner', () => {
  assert.equal(computeRates([{ iface: 'eth0', rxTotal: 100, txTotal: 100 }], Date.now(), null), null);
});

test('computeRates çok yakın iki okumayı atlar (dt < 0.5s)', () => {
  const prev = { ts: 1000, map: new Map([['eth0', { rxTotal: 0, txTotal: 0 }]]) };
  const result = computeRates([{ iface: 'eth0', rxTotal: 100, txTotal: 100 }], 1300, prev);
  assert.equal(result, null);
});

test('computeRates saniyedeki byte farkını hesaplar', () => {
  const prev = { ts: 1000, map: new Map([['eth0', { rxTotal: 1000, txTotal: 500 }]]) };
  const sample = [{ iface: 'eth0', rxTotal: 3000, txTotal: 1500, rxErrors: 0, txErrors: 0 }];
  const [row] = computeRates(sample, 3000, prev); // 2s geçti
  assert.equal(row.rx, 1000); // (3000-1000)/2
  assert.equal(row.tx, 500);  // (1500-500)/2
});

test('computeRates sayaç sıfırlanmasını (32-bit sarma) negatife düşürmez', () => {
  const prev = { ts: 1000, map: new Map([['eth0', { rxTotal: 5000, txTotal: 5000 }]]) };
  const sample = [{ iface: 'eth0', rxTotal: 100, txTotal: 100, rxErrors: 0, txErrors: 0 }];
  const [row] = computeRates(sample, 2000, prev);
  assert.equal(row.rx, 0);
  assert.equal(row.tx, 0);
});

test('computeTotals varsayılan arayüzün trafiğini toplar', () => {
  const computed = [
    { iface: 'eth0', rx: 100, tx: 50 },
    { iface: 'wg0', rx: 10, tx: 5 },
  ];
  const { networkTotal, network } = computeTotals(computed, 'eth0');
  assert.deepEqual(networkTotal, { rx: 100, tx: 50, iface: 'eth0' });
  assert.equal(network.find(n => n.iface === 'eth0').primary, true);
  assert.equal(network.find(n => n.iface === 'wg0').primary, false);
});

test('computeTotals varsayılan arayüz bulunamazsa TÜM arayüzleri toplamaz (çift sayımı önler)', () => {
  const computed = [
    { iface: 'eth0', rx: 100, tx: 50 },
    { iface: 'wg0', rx: 10, tx: 5 },
  ];
  const { networkTotal } = computeTotals(computed, null);
  assert.deepEqual(networkTotal, { rx: 0, tx: 0, iface: null });
});

test('computeTotals varsayılan arayüz sanal olduğu için listede yoksa 0 döner', () => {
  // computed zaten sanal arayüzler elenmiş halde gelir; route bir tun0
  // gösteriyor olabilir ama bu isVirtualIface tarafından süzülmüş olur.
  const computed = [{ iface: 'eth0', rx: 100, tx: 50 }];
  const { networkTotal } = computeTotals(computed, 'tun0');
  assert.deepEqual(networkTotal, { rx: 0, tx: 0, iface: 'tun0' });
});
