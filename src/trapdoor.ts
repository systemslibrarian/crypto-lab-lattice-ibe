import {
  add,
  centeredMod,
  determinantBareiss,
  dot,
  gramSchmidtRows,
  invertTwoByTwo,
  isPrime,
  matVec,
  mod,
  multiplyMatrices,
  norm,
  scale,
  subtract,
  transpose,
} from './math.ts';
import {
  GAUSSIAN_R,
  M,
  N,
  PUBLIC_MATRIX,
  Q,
  SAMPLE_TAU,
  TRAPDOOR_BASIS,
} from './params.ts';
import type { Mat, RandomSource, Vec } from './types.ts';

export interface IntegerGaussianTrace {
  readonly center: number;
  readonly width: number;
  readonly lower: number;
  readonly upper: number;
  readonly value: number;
  readonly attempts: number;
}

export interface SampleDRound extends IntegerGaussianTrace {
  readonly basisIndex: number;
  readonly gramSchmidtNorm: number;
}

export interface SampleDResult {
  readonly latticeVector: readonly number[];
  readonly rounds: readonly SampleDRound[];
}

export interface PreimageSample {
  readonly syndrome: readonly number[];
  readonly representative: readonly number[];
  readonly latticeVector: readonly number[];
  readonly key: readonly number[];
  readonly keyNorm: number;
  readonly relation: readonly number[];
  readonly rounds: readonly SampleDRound[];
}

export interface ProfileEvidence {
  readonly primeModulus: boolean;
  readonly kernelProduct: readonly (readonly number[])[];
  readonly completeKernelBasis: boolean;
  readonly determinant: bigint;
  readonly expectedDeterminant: bigint;
  readonly gramSchmidtNorms: readonly number[];
  readonly maxGramSchmidtNorm: number;
  readonly samplerRatio: number;
  readonly ajtaiMinimumM: number;
  readonly dualMinimumM: number;
  readonly dualMinimumQ: number;
  readonly passesAjtaiDimension: boolean;
  readonly passesDualDimension: boolean;
  readonly passesDualModulus: boolean;
}

export function relationFor(vector: Vec): number[] {
  return matVec(PUBLIC_MATRIX, vector).map((value) => mod(value, Q));
}

export function relationMatches(vector: Vec, syndrome: Vec): boolean {
  if (syndrome.length !== N) return false;
  const actual = relationFor(vector);
  return actual.every((value, index) => value === syndrome[index]);
}

export function profileEvidence(): ProfileEvidence {
  const kernelProduct = multiplyMatrices(PUBLIC_MATRIX, transpose(TRAPDOOR_BASIS)).map((row) =>
    row.map((value) => mod(value, Q)),
  );
  const determinant = determinantBareiss(TRAPDOOR_BASIS);
  const expectedDeterminant = BigInt(Q) ** BigInt(N);
  const gramSchmidtNorms = gramSchmidtRows(TRAPDOOR_BASIS).norms;
  const maxGramSchmidtNorm = Math.max(...gramSchmidtNorms);
  const logQ = Math.log2(Q);
  const ajtaiMinimumM = Math.ceil(5 * N * logQ);
  const dualMinimumM = Math.ceil(2 * N * logQ);
  const dualMinimumQ = 5 * GAUSSIAN_R * (M + 1);
  return {
    primeModulus: isPrime(Q),
    kernelProduct,
    completeKernelBasis:
      kernelProduct.every((row) => row.every((value) => value === 0)) &&
      (determinant < 0n ? -determinant : determinant) === expectedDeterminant,
    determinant,
    expectedDeterminant,
    gramSchmidtNorms,
    maxGramSchmidtNorm,
    samplerRatio: GAUSSIAN_R / maxGramSchmidtNorm,
    ajtaiMinimumM,
    dualMinimumM,
    dualMinimumQ,
    passesAjtaiDimension: M >= ajtaiMinimumM,
    passesDualDimension: M >= dualMinimumM,
    passesDualModulus: Q >= dualMinimumQ,
  };
}

export function arbitraryPreimage(syndrome: Vec): number[] {
  if (syndrome.length !== N || syndrome.some((value) => !Number.isSafeInteger(value))) {
    throw new Error('SYNDROME_DIMENSION');
  }
  const leftBlock: Mat = PUBLIC_MATRIX.map((row) => row.slice(0, N));
  const inverse = invertTwoByTwo(leftBlock, Q);
  const left = matVec(inverse, syndrome).map((value) => centeredMod(value, Q));
  const representative = [...left, ...Array<number>(M - N).fill(0)];
  if (!relationMatches(representative, syndrome.map((value) => mod(value, Q)))) {
    throw new Error('PREIMAGE_SOLVE_INTERNAL');
  }
  return representative;
}

export function sampleIntegerGaussian(
  width: number,
  center: number,
  rng: RandomSource,
  tau = SAMPLE_TAU,
): IntegerGaussianTrace {
  if (!Number.isFinite(width) || width <= 0) throw new Error('GAUSSIAN_WIDTH');
  if (!Number.isFinite(center)) throw new Error('GAUSSIAN_CENTER');
  if (!Number.isFinite(tau) || tau < 1) throw new Error('GAUSSIAN_TAU');
  const lower = Math.ceil(center - width * tau);
  const upper = Math.floor(center + width * tau);
  if (lower > upper) throw new Error('GAUSSIAN_WINDOW');
  for (let attempts = 1; attempts <= 4096; attempts += 1) {
    const candidate = rng.uniformInt(lower, upper);
    const normalized = (candidate - center) / width;
    const acceptance = Math.exp(-Math.PI * normalized * normalized);
    if (rng.nextFloat() < acceptance) {
      return {
        center,
        width,
        lower,
        upper,
        value: candidate,
        attempts,
      };
    }
  }
  throw new Error('GAUSSIAN_REJECTION_CAP');
}

export function sampleD(
  basis: Mat,
  gaussianWidth: number,
  center: Vec,
  rng: RandomSource,
): SampleDResult {
  if (center.length !== basis.length) throw new Error('SAMPLED_CENTER_DIMENSION');
  const { orthogonal, norms } = gramSchmidtRows(basis);
  let currentCenter = [...center];
  let latticeVector = Array<number>(basis.length).fill(0);
  const rounds: SampleDRound[] = [];
  for (let index = basis.length - 1; index >= 0; index -= 1) {
    const orthogonalVector = orthogonal[index]!;
    const basisVector = basis[index]!;
    const gramSchmidtNorm = norms[index]!;
    const oneDimensionalCenter =
      dot(currentCenter, orthogonalVector) / dot(orthogonalVector, orthogonalVector);
    const oneDimensionalWidth = gaussianWidth / gramSchmidtNorm;
    const sample = sampleIntegerGaussian(oneDimensionalWidth, oneDimensionalCenter, rng);
    currentCenter = subtract(currentCenter, scale(basisVector, sample.value));
    latticeVector = add(latticeVector, scale(basisVector, sample.value));
    rounds.push({
      basisIndex: index + 1,
      gramSchmidtNorm,
      ...sample,
    });
  }
  return { latticeVector, rounds };
}

export function samplePreimage(syndrome: Vec, rng: RandomSource): PreimageSample {
  const normalizedSyndrome = syndrome.map((value) => mod(value, Q));
  const representative = arbitraryPreimage(normalizedSyndrome);
  const sampled = sampleD(TRAPDOOR_BASIS, GAUSSIAN_R, scale(representative, -1), rng);
  const key = add(representative, sampled.latticeVector);
  const relation = relationFor(key);
  if (!relationMatches(key, normalizedSyndrome)) throw new Error('SAMPLE_PREIMAGE_INTERNAL');
  return {
    syndrome: normalizedSyndrome,
    representative,
    latticeVector: sampled.latticeVector,
    key,
    keyNorm: norm(key),
    relation,
    rounds: sampled.rounds,
  };
}
