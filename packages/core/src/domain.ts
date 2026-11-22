const MULTI_PART_SLD = new Set(['co', 'com', 'gov', 'net', 'org', 'ac', 'edu', 'nic', 'res', 'gen', 'firm', 'ind']);

/** Approximate registrable domain ("eTLD+1") without a public-suffix list. */
export function registrableDomain(host: string): string {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (isIpHost(h)) return h;
  const parts = h.split('.');
  if (parts.length <= 2) return h;
  const tld = parts[parts.length - 1]!;
  const sld = parts[parts.length - 2]!;
  if (tld.length === 2 && MULTI_PART_SLD.has(sld)) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

export const isIpHost = (host: string) =>
  /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || /^\[.*\]$/.test(host);

export function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

/** Levenshtein distance, early-exits above max. */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}
