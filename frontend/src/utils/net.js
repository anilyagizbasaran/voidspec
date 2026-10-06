// Anlık indirme/yükleme hızı. Backend `networkTotal`ı varsayılan rotanın
// arayüzünden hesaplıyor (tünel/köprü arayüzleri çift sayılmasın diye).
// Eski backend'e karşı dayanıklı olsun diye toplama düşen bir yedek var.
export function netTotals(stats) {
  if (stats?.networkTotal) {
    return { rx: stats.networkTotal.rx || 0, tx: stats.networkTotal.tx || 0 };
  }
  const list = stats?.network || [];
  const primary = list.filter(n => n.primary);
  const src = primary.length ? primary : list;
  return {
    rx: src.reduce((s, n) => s + (n.rx || 0), 0),
    tx: src.reduce((s, n) => s + (n.tx || 0), 0),
  };
}
