import { describe, expect, it } from 'vitest';
import { identityToSyndrome } from './hash.ts';
import {
  decryptionResidual,
  decryptBit,
  encryptBit,
  keyValidForSyndrome,
} from './ibe.ts';
import { HALF_Q, PUBLIC_MATRIX, Q } from './params.ts';
import { SeededRandom } from './random.ts';
import { samplePreimage } from './trapdoor.ts';

function independentResidual(
  key: readonly number[],
  vectorError: readonly number[],
  scalarError: number,
): number {
  let value = BigInt(scalarError);
  for (let index = 0; index < key.length; index += 1) {
    value -= BigInt(key[index] ?? 0) * BigInt(vectorError[index] ?? 0);
  }
  const reduced = ((value % BigInt(Q)) + BigInt(Q)) % BigInt(Q);
  return Number(reduced);
}

describe('GPV dual-LWE bit equations', () => {
  it('round-trips both bits across a seed census', async () => {
    const { syndrome } = await identityToSyndrome('alice@example.edu');
    for (let index = 0; index < 256; index += 1) {
      const key = samplePreimage(syndrome, new SeededRandom(`key-${index}`)).key;
      for (const bit of [0, 1] as const) {
        const ciphertext = encryptBit(syndrome, bit, new SeededRandom(`ct-${index}-${bit}`));
        expect(decryptBit(key, ciphertext).bit, `seed ${index}, bit ${bit}`).toBe(bit);
      }
    }
  });

  it('computes p and c from the displayed secret and errors', async () => {
    const { syndrome } = await identityToSyndrome('alice@example.edu');
    const ciphertext = encryptBit(syndrome, 1, new SeededRandom('equation-check'));
    const expectedP = Array.from({ length: 4 }, (_, column) => {
      let total = ciphertext.vectorError[column] ?? 0;
      for (let row = 0; row < 2; row += 1) {
        total += (PUBLIC_MATRIX[row]?.[column] ?? 0) * (ciphertext.secret[row] ?? 0);
      }
      return ((total % Q) + Q) % Q;
    });
    const expectedC =
      ((syndrome.reduce(
        (sum, coordinate, index) => sum + coordinate * (ciphertext.secret[index] ?? 0),
        ciphertext.scalarError + HALF_Q,
      ) % Q) + Q) % Q;
    expect(ciphertext.p).toEqual(expectedP);
    expect(ciphertext.c).toBe(expectedC);
  });

  it('derives the same residual by two independent routes', async () => {
    const { syndrome } = await identityToSyndrome('alice@example.edu');
    const key = samplePreimage(syndrome, new SeededRandom('residual-key')).key;
    const ciphertext = encryptBit(syndrome, 1, new SeededRandom('residual-ct'));
    const residual = decryptionResidual(key, ciphertext);
    expect(residual.fromCiphertext).toBe(residual.fromErrors);
    expect(residual.fromErrors).toBe(
      independentResidual(key, ciphertext.vectorError, ciphertext.scalarError),
    );
  });

  it('rejects a one-coordinate key mutation at the relation boundary', async () => {
    const { syndrome } = await identityToSyndrome('alice@example.edu');
    const key = samplePreimage(syndrome, new SeededRandom('relation-key')).key;
    const mutated = [...key];
    mutated[0] = (mutated[0] ?? 0) + 1;
    expect(keyValidForSyndrome(key, syndrome)).toBe(true);
    expect(keyValidForSyndrome(mutated, syndrome)).toBe(false);
  });

  it('makes the oversized-error control flip the decoded bit', async () => {
    const { syndrome } = await identityToSyndrome('alice@example.edu');
    const key = samplePreimage(syndrome, new SeededRandom('oversized-key')).key;
    for (const bit of [0, 1] as const) {
      const ciphertext = encryptBit(
        syndrome,
        bit,
        new SeededRandom(`oversized-${bit}`),
        'oversized',
      );
      expect(decryptBit(key, ciphertext).bit).toBe(bit === 0 ? 1 : 0);
    }
  });

  it('validates dimensions and inputs', () => {
    expect(() => encryptBit([1], 0, new SeededRandom('bad'))).toThrow(/ENCRYPT_SYNDROME/);
    expect(() => decryptBit([1], { p: [1], c: 1 })).toThrow(/DECRYPT_DIMENSION/);
  });
});
