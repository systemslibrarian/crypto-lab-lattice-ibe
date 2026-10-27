import { centeredBinomialOne } from './random.ts';
import { columns, distanceModulo, dot, mod } from './math.ts';
import { HALF_Q, M, N, PUBLIC_MATRIX, Q } from './params.ts';
import { relationMatches } from './trapdoor.ts';
import type { RandomSource, Vec } from './types.ts';

export type ErrorMode = 'cbd1' | 'oversized';

export interface DualCiphertext {
  readonly p: readonly number[];
  readonly c: number;
  readonly secret: readonly number[];
  readonly vectorError: readonly number[];
  readonly scalarError: number;
  readonly encodedBit: 0 | 1;
  readonly errorMode: ErrorMode;
}

export interface DecryptionResult {
  readonly phase: number;
  readonly distanceToZero: number;
  readonly distanceToHalf: number;
  readonly bit: 0 | 1;
}

export function encryptBit(
  syndrome: Vec,
  bit: 0 | 1,
  rng: RandomSource,
  errorMode: ErrorMode = 'cbd1',
): DualCiphertext {
  if (syndrome.length !== N || syndrome.some((value) => !Number.isSafeInteger(value))) {
    throw new Error('ENCRYPT_SYNDROME');
  }
  const secret = Array.from({ length: N }, () => rng.uniformInt(0, Q - 1));
  const vectorError =
    errorMode === 'cbd1'
      ? Array.from({ length: M }, () => centeredBinomialOne(rng))
      : Array<number>(M).fill(0);
  const scalarError = errorMode === 'cbd1' ? centeredBinomialOne(rng) : HALF_Q;
  const p = columns(PUBLIC_MATRIX).map((column, index) =>
    mod(dot(column, secret) + vectorError[index]!, Q),
  );
  const c = mod(dot(syndrome, secret) + scalarError + bit * HALF_Q, Q);
  return { p, c, secret, vectorError, scalarError, encodedBit: bit, errorMode };
}

export function decryptBit(key: Vec, ciphertext: Pick<DualCiphertext, 'p' | 'c'>): DecryptionResult {
  if (key.length !== M || ciphertext.p.length !== M) throw new Error('DECRYPT_DIMENSION');
  const phase = mod(ciphertext.c - dot(key, ciphertext.p), Q);
  const distanceToZero = distanceModulo(phase, 0, Q);
  const distanceToHalf = distanceModulo(phase, HALF_Q, Q);
  return {
    phase,
    distanceToZero,
    distanceToHalf,
    bit: distanceToZero <= distanceToHalf ? 0 : 1,
  };
}

export function decryptionResidual(
  key: Vec,
  ciphertext: DualCiphertext,
): { readonly fromCiphertext: number; readonly fromErrors: number } {
  const fromCiphertext = mod(
    ciphertext.c - dot(key, ciphertext.p) - ciphertext.encodedBit * HALF_Q,
    Q,
  );
  const fromErrors = mod(ciphertext.scalarError - dot(key, ciphertext.vectorError), Q);
  return { fromCiphertext, fromErrors };
}

export function keyValidForSyndrome(key: Vec, syndrome: Vec): boolean {
  return relationMatches(key, syndrome);
}
