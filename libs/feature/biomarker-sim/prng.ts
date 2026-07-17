// deterministic PRNG helpers — the whole simulator keys off these so regenerating
// any window is byte-identical (which makes re-ingest a no-op via the tsdb unique
// index). No Math.random anywhere.

// fnv-1a 32-bit string hash
export const hashSeed = (input: string): number => {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
};

// mulberry32 — small, fast, good-enough distribution for synthetic sensor noise
export const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// standard normal via Box-Muller, driven by a mulberry32 stream
export const gaussian = (next: () => number): number => {
  const u = Math.max(next(), Number.EPSILON);
  const v = next();

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
