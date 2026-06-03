export function fmtBytes(b, dec = 1) {
  if (!b) return '0 B';
  const k = 1024, s = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(Math.max(b,1)) / Math.log(k));
  return `${parseFloat((b / Math.pow(k,i)).toFixed(dec))} ${s[i]}`;
}

export function fmtUptime(s) {
  if (!s) return '—';
  const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60);
  return [d&&`${d}d`, h&&`${h}h`, `${m}m`].filter(Boolean).join(' ');
}

export function healthColor(pct) {
  if (pct > 85) return { text: 'text-panel-red',    bar: 'bg-panel-red'    };
  if (pct > 65) return { text: 'text-panel-yellow', bar: 'bg-panel-yellow' };
  return           { text: 'text-panel-green',  bar: 'bg-panel-green'  };
}
