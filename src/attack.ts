import { mod, norm } from './math.ts';
import { N, PUBLIC_MATRIX, Q } from './params.ts';
import type { Vec } from './types.ts';

export interface PublicSearchResult {
  readonly bound: number;
  readonly operations: number;
  readonly matches: number;
  readonly key: readonly number[] | null;
  readonly keyNorm: number | null;
  readonly relation: readonly number[] | null;
}

function publicRelation(vector: Vec): number[] {
  return PUBLIC_MATRIX.map((row) =>
    mod(row.reduce((sum, value, index) => sum + value * vector[index]!, 0), Q),
  );
}

/** Meet-in-the-middle bounded search whose module imports only public parameters. */
export function publicPreimageSearch(syndrome: Vec, bound: number): PublicSearchResult {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > 128) {
    throw new Error('PUBLIC_SEARCH_BOUND');
  }
  const normalizedSyndrome = syndrome.map((value) => mod(value, Q));
  if (normalizedSyndrome.length !== N) throw new Error('SYNDROME_DIMENSION');
  const firstHalf = new Map<string, readonly [number, number]>();
  let operations = 0;
  for (let first = -bound; first <= bound; first += 1) {
    for (let second = -bound; second <= bound; second += 1) {
      operations += 1;
      const contribution = [
        mod(PUBLIC_MATRIX[0]![0]! * first + PUBLIC_MATRIX[0]![1]! * second, Q),
        mod(PUBLIC_MATRIX[1]![0]! * first + PUBLIC_MATRIX[1]![1]! * second, Q),
      ];
      const key = contribution.join(',');
      const existing = firstHalf.get(key);
      if (!existing || first * first + second * second < existing[0] ** 2 + existing[1] ** 2) {
        firstHalf.set(key, [first, second]);
      }
    }
  }
  let best: number[] | null = null;
  let bestNorm = Number.POSITIVE_INFINITY;
  let matches = 0;
  for (let third = -bound; third <= bound; third += 1) {
    for (let fourth = -bound; fourth <= bound; fourth += 1) {
      operations += 1;
      const right = [
        PUBLIC_MATRIX[0]![2]! * third + PUBLIC_MATRIX[0]![3]! * fourth,
        PUBLIC_MATRIX[1]![2]! * third + PUBLIC_MATRIX[1]![3]! * fourth,
      ];
      const needed = [
        mod(normalizedSyndrome[0]! - right[0]!, Q),
        mod(normalizedSyndrome[1]! - right[1]!, Q),
      ];
      const left = firstHalf.get(needed.join(','));
      if (!left) continue;
      matches += 1;
      const candidate = [left[0], left[1], third, fourth];
      const candidateNorm = norm(candidate);
      if (candidateNorm < bestNorm) {
        best = candidate;
        bestNorm = candidateNorm;
      }
    }
  }
  return {
    bound,
    operations,
    matches,
    key: best,
    keyNorm: best ? bestNorm : null,
    relation: best ? publicRelation(best) : null,
  };
}
