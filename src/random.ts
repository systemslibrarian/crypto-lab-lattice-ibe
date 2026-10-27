import type { RandomSource } from './types.ts';

/**
 * Deterministic classroom randomness. This is deliberately reproducible and is
 * never represented as a cryptographic RNG.
 */
export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed: string) {
    let h = 0x811c9dc5;
    for (const byte of new TextEncoder().encode(seed)) {
      h ^= byte;
      h = Math.imul(h, 0x01000193);
    }
    this.state = (h >>> 0) || 0x6d2b79f5;
  }

  nextUint32(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  nextFloat(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  uniformInt(minInclusive: number, maxInclusive: number): number {
    if (!Number.isSafeInteger(minInclusive) || !Number.isSafeInteger(maxInclusive)) {
      throw new Error('RNG_BOUNDS: integer bounds required');
    }
    if (maxInclusive < minInclusive) throw new Error('RNG_BOUNDS: empty interval');
    const span = maxInclusive - minInclusive + 1;
    if (span > 0x1_0000_0000) throw new Error('RNG_BOUNDS: interval too wide');
    const limit = Math.floor(0x1_0000_0000 / span) * span;
    let word = this.nextUint32();
    while (word >= limit) word = this.nextUint32();
    return minInclusive + (word % span);
  }
}

/** Difference of two independent bits: probabilities 1/4, 1/2, 1/4. */
export function centeredBinomialOne(rng: RandomSource): -1 | 0 | 1 {
  const firstBit = rng.uniformInt(0, 1);
  const secondBit = rng.uniformInt(0, 1);
  return (firstBit - secondBit) as -1 | 0 | 1;
}
