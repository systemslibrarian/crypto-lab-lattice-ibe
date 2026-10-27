import { identityToSyndrome, type IdentitySyndrome } from './hash.ts';
import {
  decryptionResidual,
  decryptBit,
  encryptBit,
  keyValidForSyndrome,
  type DecryptionResult,
  type DualCiphertext,
} from './ibe.ts';
import { SeededRandom } from './random.ts';
import { publicPreimageSearch, type PublicSearchResult } from './attack.ts';
import {
  profileEvidence,
  samplePreimage,
  type PreimageSample,
  type ProfileEvidence,
} from './trapdoor.ts';

export interface ScenarioInput {
  readonly identity: string;
  readonly otherIdentity: string;
  readonly bit: 0 | 1;
  readonly seed: string;
}

export const DEFAULT_INPUT: ScenarioInput = {
  identity: 'alice@example.edu',
  otherIdentity: 'bob@example.edu',
  bit: 1,
  seed: 'gpv-classroom-01',
};

export interface ExtractionResult extends PreimageSample {
  readonly cacheHit: boolean;
}

export class ToyExtractionAuthority {
  private readonly cache = new Map<string, PreimageSample>();

  constructor(private readonly seed: string) {}

  extract(mapping: IdentitySyndrome): ExtractionResult {
    const cached = this.cache.get(mapping.identity);
    if (cached) return { ...cached, cacheHit: true };
    const sampled = samplePreimage(
      mapping.syndrome,
      new SeededRandom(`${this.seed}:extract:${mapping.identity}`),
    );
    this.cache.set(mapping.identity, sampled);
    return { ...sampled, cacheHit: false };
  }
}

export interface ScenarioResult {
  readonly input: ScenarioInput;
  readonly identity: IdentitySyndrome;
  readonly otherIdentity: IdentitySyndrome;
  readonly extraction: ExtractionResult;
  readonly repeatedExtraction: ExtractionResult;
  readonly freshAuthorityExtraction: ExtractionResult;
  readonly ciphertext: DualCiphertext;
  readonly decryption: DecryptionResult;
  readonly residual: ReturnType<typeof decryptionResidual>;
  readonly publicSearch: PublicSearchResult;
  readonly publicSearchDecryption: DecryptionResult | null;
  readonly otherExtraction: ExtractionResult;
  readonly wrongIdentityDecryption: DecryptionResult;
  readonly primaryKeyMatchesOtherIdentity: boolean;
  readonly mutatedKey: readonly number[];
  readonly mutatedKeyAccepted: boolean;
  readonly oversizedCiphertext: DualCiphertext;
  readonly oversizedDecryption: DecryptionResult;
  readonly profile: ProfileEvidence;
}

export async function runScenario(input: ScenarioInput): Promise<ScenarioResult> {
  if (input.identity === input.otherIdentity) {
    throw new Error('SCENARIO_IDENTITIES: choose two distinct exact identities');
  }
  if (input.seed.length < 1 || input.seed.length > 96) {
    throw new Error('SCENARIO_SEED: use 1-96 characters');
  }
  const [identity, otherIdentity] = await Promise.all([
    identityToSyndrome(input.identity),
    identityToSyndrome(input.otherIdentity),
  ]);
  const authority = new ToyExtractionAuthority(input.seed);
  const extraction = authority.extract(identity);
  const repeatedExtraction = authority.extract(identity);
  const freshAuthorityExtraction = new ToyExtractionAuthority(`${input.seed}:fresh`).extract(identity);
  const ciphertext = encryptBit(
    identity.syndrome,
    input.bit,
    new SeededRandom(`${input.seed}:encrypt:${input.identity}`),
  );
  const decryption = decryptBit(extraction.key, ciphertext);
  const residual = decryptionResidual(extraction.key, ciphertext);
  const publicSearch = publicPreimageSearch(identity.syndrome, 64);
  const publicSearchDecryption = publicSearch.key
    ? decryptBit(publicSearch.key, ciphertext)
    : null;
  const otherExtraction = authority.extract(otherIdentity);
  const wrongIdentityDecryption = decryptBit(otherExtraction.key, ciphertext);
  const mutatedKey = [...extraction.key];
  mutatedKey[0] = mutatedKey[0]! + 1;
  const oversizedCiphertext = encryptBit(
    identity.syndrome,
    input.bit,
    new SeededRandom(`${input.seed}:oversized:${input.identity}`),
    'oversized',
  );
  const oversizedDecryption = decryptBit(extraction.key, oversizedCiphertext);
  return {
    input,
    identity,
    otherIdentity,
    extraction,
    repeatedExtraction,
    freshAuthorityExtraction,
    ciphertext,
    decryption,
    residual,
    publicSearch,
    publicSearchDecryption,
    otherExtraction,
    wrongIdentityDecryption,
    primaryKeyMatchesOtherIdentity: keyValidForSyndrome(extraction.key, otherIdentity.syndrome),
    mutatedKey,
    mutatedKeyAccepted: keyValidForSyndrome(mutatedKey, identity.syndrome),
    oversizedCiphertext,
    oversizedDecryption,
    profile: profileEvidence(),
  };
}
