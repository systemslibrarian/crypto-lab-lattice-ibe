import { describe, expect, it } from 'vitest';
import { centeredBinomialOne, SeededRandom } from './random.ts';

describe('declared classroom random source', () => {
  it('is deterministic and produces values in requested ranges', () => {
    const first = new SeededRandom('same-seed');
    const second = new SeededRandom('same-seed');
    expect(Array.from({ length: 8 }, () => first.nextUint32()))
      .toEqual(Array.from({ length: 8 }, () => second.nextUint32()));
    const ranged = new SeededRandom('ranges');
    expect(Array.from({ length: 50 }, () => ranged.uniformInt(-3, 4))
      .every((value) => value >= -3 && value <= 4)).toBe(true);
    expect([-1, 0, 1]).toContain(centeredBinomialOne(ranged));
  });

  it('refuses malformed or oversized integer intervals', () => {
    const rng = new SeededRandom('bounds');
    expect(() => rng.uniformInt(0.5, 1)).toThrow(/RNG_BOUNDS/);
    expect(() => rng.uniformInt(0, 1.5)).toThrow(/RNG_BOUNDS/);
    expect(() => rng.uniformInt(2, 1)).toThrow(/RNG_BOUNDS/);
    expect(() => rng.uniformInt(0, 0x1_0000_0000)).toThrow(/RNG_BOUNDS/);
  });

  it('rejects an out-of-range word before reducing it', () => {
    const rng = new SeededRandom('forced-rejection');
    const words = [0xffff_ffff, 7];
    rng.nextUint32 = () => words.shift()!;
    expect(rng.uniformInt(0, 9)).toBe(7);
    expect(words).toHaveLength(0);
  });
});
