import { describe, expect, it } from 'vitest';
import { SeededRandom } from './random.ts';
import { identityToSyndrome } from './hash.ts';
import { GAUSSIAN_R, PUBLIC_MATRIX, Q, TRAPDOOR_BASIS } from './params.ts';
import {
  arbitraryPreimage,
  profileEvidence,
  relationMatches,
  sampleD,
  sampleIntegerGaussian,
  samplePreimage,
} from './trapdoor.ts';

function independentRelation(vector: readonly number[]): number[] {
  return PUBLIC_MATRIX.map((row) => {
    let sum = 0n;
    for (let index = 0; index < row.length; index += 1) {
      sum += BigInt(row[index] ?? 0) * BigInt(vector[index] ?? 0);
    }
    const reduced = ((sum % BigInt(Q)) + BigInt(Q)) % BigInt(Q);
    return Number(reduced);
  });
}

describe('fixed q-ary trapdoor profile', () => {
  it('proves the basis is the complete kernel, not only four kernel vectors', () => {
    const evidence = profileEvidence();
    expect(evidence.primeModulus).toBe(true);
    expect(evidence.publicMatrixFullRowRank).toBe(true);
    const leftMinorDeterminant =
      PUBLIC_MATRIX[0]![0]! * PUBLIC_MATRIX[1]![1]! -
      PUBLIC_MATRIX[0]![1]! * PUBLIC_MATRIX[1]![0]!;
    expect(((leftMinorDeterminant % Q) + Q) % Q).not.toBe(0);
    expect(evidence.kernelProduct).toEqual([[0, 0, 0, 0], [0, 0, 0, 0]]);
    expect(evidence.determinant < 0n ? -evidence.determinant : evidence.determinant)
      .toBe(BigInt(Q) ** 2n);
    expect(evidence.completeKernelBasis).toBe(true);
    expect(evidence.maxGramSchmidtNorm).toBeCloseTo(86.00181988936374, 10);
    expect(evidence.samplerRatio).toBeCloseTo(GAUSSIAN_R / 86.00181988936374, 10);
    expect(evidence.ajtaiMinimumM).toBe(120);
    expect(evidence.dualMinimumM).toBe(48);
    expect(evidence.dualMinimumQ).toBe(6400);
  });

  it('keeps every basis row in the public modular kernel', () => {
    for (const row of TRAPDOOR_BASIS) expect(independentRelation(row)).toEqual([0, 0]);
  });

  it('solves for an arbitrary coset representative', () => {
    const target = [123, 456];
    const representative = arbitraryPreimage(target);
    expect(independentRelation(representative)).toEqual(target);
    expect(() => arbitraryPreimage([1])).toThrow(/SYNDROME_DIMENSION/);
    expect(() => arbitraryPreimage([1, 2.5])).toThrow(/SYNDROME_DIMENSION/);
    expect(relationMatches([1, 2, 3, 4], [1])).toBe(false);
  });

  it('runs SampleZ in the declared finite rejection window', () => {
    const sample = sampleIntegerGaussian(3.25, -1.5, new SeededRandom('sample-z'));
    expect(sample.value).toBe(-1);
    expect(sample.attempts).toBe(2);
    expect(sample.value).toBeGreaterThanOrEqual(sample.lower);
    expect(sample.value).toBeLessThanOrEqual(sample.upper);
    expect(sample.attempts).toBeGreaterThan(0);
    expect(() => sampleIntegerGaussian(0, 0, new SeededRandom('bad'))).toThrow(/GAUSSIAN_WIDTH/);
    expect(() => sampleIntegerGaussian(1, Number.NaN, new SeededRandom('bad'))).toThrow(/GAUSSIAN_CENTER/);
    expect(() => sampleIntegerGaussian(1, 0, new SeededRandom('bad'), 0)).toThrow(/GAUSSIAN_TAU/);
    expect(() => sampleIntegerGaussian(0.01, 0.5, new SeededRandom('bad'), 1)).toThrow(/GAUSSIAN_WINDOW/);
    const refusingRandom = {
      nextUint32: () => 0,
      uniformInt: () => 0,
      nextFloat: () => 1,
    };
    expect(() => sampleIntegerGaussian(1, 0, refusingRandom)).toThrow(/GAUSSIAN_REJECTION_CAP/);
  });

  it('runs randomized nearest plane and returns a lattice vector', () => {
    const sampled = sampleD(TRAPDOOR_BASIS, GAUSSIAN_R, [10, -5, 7, 3], new SeededRandom('sample-d'));
    expect(sampled.rounds).toHaveLength(4);
    expect(independentRelation(sampled.latticeVector)).toEqual([0, 0]);
    expect(sampled.rounds.map((round) => round.basisIndex)).toEqual([4, 3, 2, 1]);
    expect(() => sampleD(TRAPDOOR_BASIS, GAUSSIAN_R, [1], new SeededRandom('bad')))
      .toThrow(/SAMPLED_CENTER_DIMENSION/);
  });

  it('extracts different short preimages for one public identity', async () => {
    const { syndrome } = await identityToSyndrome('alice@example.edu');
    const first = samplePreimage(syndrome, new SeededRandom('extract-one'));
    const second = samplePreimage(syndrome, new SeededRandom('extract-two'));
    expect(first.key).not.toEqual(second.key);
    expect(first.relation).toEqual(syndrome);
    expect(second.relation).toEqual(syndrome);
    expect(independentRelation(first.key)).toEqual(syndrome);
    expect(first.key).toEqual(first.representative.map(
      (coordinate, index) => coordinate + first.latticeVector[index]!,
    ));
    expect(first.keyNorm).toBeGreaterThan(0);
  });

});
