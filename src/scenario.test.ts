import { describe, expect, it } from 'vitest';
import { INTERFACE_COMPARISONS } from './comparison.ts';
import { DEFAULT_INPUT, runScenario, ToyExtractionAuthority } from './scenario.ts';
import { identityToSyndrome } from './hash.ts';

describe('complete learner scenario', () => {
  it('derives every displayed verdict from the current run', async () => {
    const result = await runScenario(DEFAULT_INPUT);
    expect(result.extraction.cacheHit).toBe(false);
    expect(result.repeatedExtraction.cacheHit).toBe(true);
    expect(result.repeatedExtraction.key).toEqual(result.extraction.key);
    expect(result.freshAuthorityExtraction.key).not.toEqual(result.extraction.key);
    expect(result.decryption.bit).toBe(DEFAULT_INPUT.bit);
    expect(result.residual.fromCiphertext).toBe(result.residual.fromErrors);
    expect(result.publicSearch.key).not.toBeNull();
    expect(result.publicSearchDecryption?.bit).toBe(DEFAULT_INPUT.bit);
    expect(result.primaryKeyMatchesOtherIdentity).toBe(false);
    expect(result.mutatedKeyAccepted).toBe(false);
    expect(result.oversizedDecryption.bit).not.toBe(DEFAULT_INPUT.bit);
    expect(result.profile.completeKernelBasis).toBe(true);
    expect(result.profile.passesAjtaiDimension).toBe(false);
    expect(result.profile.passesDualDimension).toBe(false);
    expect(result.profile.passesDualModulus).toBe(false);
  });

  it('changes the syndrome and run outputs when the identity changes', async () => {
    const first = await runScenario(DEFAULT_INPUT);
    const second = await runScenario({ ...DEFAULT_INPUT, identity: 'carol@example.edu' });
    expect(second.identity.syndrome).not.toEqual(first.identity.syndrome);
    expect(second.extraction.key).not.toEqual(first.extraction.key);
    expect(second.ciphertext.p).not.toEqual(first.ciphertext.p);
  });

  it('refuses equal identities and invalid seeds', async () => {
    await expect(
      runScenario({ ...DEFAULT_INPUT, otherIdentity: DEFAULT_INPUT.identity }),
    ).rejects.toThrow(/SCENARIO_IDENTITIES/);
    await expect(runScenario({ ...DEFAULT_INPUT, seed: '' })).rejects.toThrow(/SCENARIO_SEED/);
  });

  it('caches one sampled key per exact identity', async () => {
    const mapping = await identityToSyndrome('alice@example.edu');
    const authority = new ToyExtractionAuthority('cache');
    const first = authority.extract(mapping);
    const second = authority.extract(mapping);
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.key).toEqual(first.key);
  });

  it('keeps comparison systems and deployment status distinct', () => {
    expect(INTERFACE_COMPARISONS).toHaveLength(3);
    expect(INTERFACE_COMPARISONS[0]?.status).toMatch(/not secure or standardized/);
    expect(INTERFACE_COMPARISONS[1]?.system).toMatch(/BasicIdent/);
    expect(INTERFACE_COMPARISONS[2]?.system).toMatch(/FAME/);
    expect(INTERFACE_COMPARISONS.some((row) => row.status.includes('ML-KEM'))).toBe(false);
  });
});
