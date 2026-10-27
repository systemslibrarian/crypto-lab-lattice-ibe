import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { publicPreimageSearch } from './attack.ts';
import { identityToSyndrome } from './hash.ts';
import { PUBLIC_MATRIX, Q } from './params.ts';

function independentRelation(vector: readonly number[]): number[] {
  return PUBLIC_MATRIX.map((row) => {
    const sum = row.reduce((total, value, index) =>
      total + BigInt(value) * BigInt(vector[index]!), 0n);
    return Number(((sum % BigInt(Q)) + BigInt(Q)) % BigInt(Q));
  });
}

describe('public bounded preimage attack', () => {
  it('finds and independently verifies a toy key from public inputs', async () => {
    const { syndrome } = await identityToSyndrome('alice@example.edu');
    const attack = publicPreimageSearch(syndrome, 64);
    expect(attack.key).not.toBeNull();
    expect(attack.matches).toBeGreaterThan(0);
    expect(attack.operations).toBe(2 * 129 * 129);
    expect(attack.relation).toEqual(syndrome);
    expect(independentRelation(attack.key ?? [])).toEqual(syndrome);
  });

  it('has no source dependency on the trapdoor or secret sampler', () => {
    const source = readFileSync(new URL('./attack.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/TRAPDOOR|samplePreimage|sampleD|trapdoor\.ts/);
    expect(source).toContain("from './params.ts'");
  });

  it('refuses invalid bounds and reports an honestly incomplete search', async () => {
    const { syndrome } = await identityToSyndrome('alice@example.edu');
    expect(() => publicPreimageSearch(syndrome, 0)).toThrow(/PUBLIC_SEARCH_BOUND/);
    expect(() => publicPreimageSearch(syndrome, 129)).toThrow(/PUBLIC_SEARCH_BOUND/);
    expect(() => publicPreimageSearch(syndrome, 1.5)).toThrow(/PUBLIC_SEARCH_BOUND/);
    expect(() => publicPreimageSearch([1], 1)).toThrow(/SYNDROME_DIMENSION/);
    const absent = publicPreimageSearch([2000, 2000], 1);
    expect(absent.key).toBeNull();
    expect(absent.keyNorm).toBeNull();
    expect(absent.relation).toBeNull();
  });
});
