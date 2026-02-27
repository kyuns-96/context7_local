export interface VectorBands {
  band1: number;
  band2: number;
  band3: number;
  band4: number;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const indexCache = new Map<number, number[]>();

function getBandIndices(dimensions: number): number[] {
  const cached = indexCache.get(dimensions);
  if (cached) return cached;

  const rng = mulberry32(0xC0FFEE);
  const indices: number[] = [];

  for (let i = 0; i < 64; i++) {
    indices.push(Math.floor(rng() * dimensions));
  }

  indexCache.set(dimensions, indices);
  return indices;
}

function buildBandSignature(values: number[], indices: number[], bandOffset: number): number {
  let signature = 0;
  for (let i = 0; i < 16; i++) {
    const idx = indices[bandOffset + i];
    if (idx === undefined) continue;
    const value = values[idx] ?? 0;
    if (value >= 0) {
      signature |= 1 << i;
    }
  }
  return signature;
}

export function computeVectorBands(values: number[]): VectorBands | null {
  if (values.length === 0) return null;
  const indices = getBandIndices(values.length);

  return {
    band1: buildBandSignature(values, indices, 0),
    band2: buildBandSignature(values, indices, 16),
    band3: buildBandSignature(values, indices, 32),
    band4: buildBandSignature(values, indices, 48),
  };
}
