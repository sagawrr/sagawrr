export const esc = str => String(str ?? '')
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Small deterministic hash (FNV-1a) → unsigned 32-bit int.
export function hash(str) {
  let h = 0x811c9dc5;
  for (const ch of String(str)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// Deterministic pseudo-random generator seeded from a string.
export function rng(seed) {
  let s = hash(seed) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

export const pick = (rand, list) => list[Math.floor(rand() * list.length)];
export const round = (n, d = 2) => Number(n.toFixed(d));
// SMIL keyTimes must be within [0,1] and non-decreasing.
export const kt = n => round(Math.min(1, Math.max(0, n)), 4);
