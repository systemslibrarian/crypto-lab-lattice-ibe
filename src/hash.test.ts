import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDENTITY_DOMAIN, identityToSyndrome, validateIdentity } from './hash.ts';
import { Q } from './params.ts';

function independentFirstDigest(identity: string): string {
  const prefix = Buffer.from(IDENTITY_DOMAIN, 'utf8');
  const input = Buffer.concat([prefix, Buffer.from([0, 0, 0, 0, 0]), Buffer.from(identity, 'utf8')]);
  return createHash('sha256').update(input).digest('hex');
}

describe('identity to syndrome', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses SHA-256 over the declared domain-separated bytes', async () => {
    const mapping = await identityToSyndrome('alice@example.edu');
    expect(mapping.digestHex).toBe(independentFirstDigest('alice@example.edu'));
    expect(mapping.syndrome).toEqual([3301, 3884]);
    expect(mapping.bytes).toEqual([...Buffer.from('alice@example.edu')]);
  });

  it('is deterministic, case-sensitive, and range bounded', async () => {
    const first = await identityToSyndrome('Alice@example.edu');
    const repeat = await identityToSyndrome('Alice@example.edu');
    const lower = await identityToSyndrome('alice@example.edu');
    expect(first).toEqual(repeat);
    expect(first.syndrome).not.toEqual(lower.syndrome);
    expect(first.syndrome).toHaveLength(2);
    expect(first.syndrome.every((coordinate) => coordinate >= 0 && coordinate < Q)).toBe(true);
  });

  it('records rejection sampling rather than reducing biased words blindly', async () => {
    let witnessed = null;
    for (let index = 0; index < 3000; index += 1) {
      const mapping = await identityToSyndrome(`student-${index}@example.edu`);
      if (mapping.rejectedWords > 0) {
        witnessed = mapping;
        break;
      }
    }
    expect(witnessed).not.toBeNull();
    expect(witnessed?.blocks).toBeGreaterThanOrEqual(1);
  });

  it('continues to a fresh counter block when one digest has no accepted words', async () => {
    let calls = 0;
    vi.stubGlobal('crypto', {
      subtle: {
        digest: async () => {
          calls += 1;
          return Uint8Array.from({ length: 32 }, () => (calls === 1 ? 0xff : 0)).buffer;
        },
      },
    });
    const mapping = await identityToSyndrome('counter@example.edu');
    expect(mapping.blocks).toBe(2);
    expect(mapping.rejectedWords).toBe(16);
    expect(mapping.syndrome).toEqual([0, 0]);
    expect(mapping.digestHex).toBe('ff'.repeat(32));
  });

  it('enforces the exact narrow identity grammar', () => {
    expect(() => validateIdentity('')).toThrow(/IDENTITY_FORMAT/);
    expect(() => validateIdentity('alice example.edu')).toThrow(/IDENTITY_FORMAT/);
    expect(() => validateIdentity('é@example.edu')).toThrow(/IDENTITY_FORMAT/);
    expect(() => validateIdentity('a'.repeat(97))).toThrow(/IDENTITY_FORMAT/);
    expect(() => validateIdentity('alice@example.edu')).not.toThrow();
  });
});
