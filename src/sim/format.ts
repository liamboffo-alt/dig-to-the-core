const SHORT = ['', 'K', 'M', 'B', 'T'];

/** 1234 -> 1.23K, 1e15 -> 1.00aa, 1e18 -> 1.00ab ... */
export function formatNumber(n: number, small = 0): string {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + formatNumber(-n, small);
  if (n < 1000) {
    if (small > 0 && n < 100 && n !== Math.floor(n)) return n.toFixed(n < 10 ? small : Math.min(small, 1));
    return Math.floor(n).toString();
  }
  let group = Math.floor(Math.log10(n) / 3);
  let scaled = n / Math.pow(1000, group);
  if (scaled >= 999.5) { scaled /= 1000; group++; } // rounding would show 1000
  const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  return scaled.toFixed(digits) + suffix(group);
}

export function suffix(group: number): string {
  if (group < SHORT.length) return SHORT[group];
  const i = group - SHORT.length;
  const letters = 26;
  if (i < letters * letters) {
    return String.fromCharCode(97 + Math.floor(i / letters)) + String.fromCharCode(97 + (i % letters));
  }
  return 'e' + group * 3;
}

/** Depth in metres, in the unit a person would use. */
export function formatDepth(m: number): string {
  if (m < 0.01) return (m * 1000).toFixed(1) + ' mm';
  if (m < 1) return (m * 100).toFixed(1) + ' cm';
  if (m < 1000) return m.toFixed(m < 100 ? 2 : 1) + ' m';
  const km = m / 1000;
  return (km < 100 ? km.toFixed(2) : km < 1000 ? km.toFixed(1) : Math.floor(km).toLocaleString('en-US')) + ' km';
}

/** Progress as a percentage with just enough decimals to see it move. */
export function formatPercent(fraction: number): string {
  const p = fraction * 100;
  if (p >= 100) return '100%';
  if (p <= 0) return '0%';
  if (p >= 10) return p.toFixed(2) + '%';
  if (p >= 1) return p.toFixed(3) + '%';
  const decimals = Math.min(9, 2 - Math.floor(Math.log10(p)));
  return p.toFixed(decimals) + '%';
}

export function formatTime(seconds: number): string {
  seconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}
