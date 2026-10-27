import { N, Q } from './params.ts';

export const IDENTITY_DOMAIN = 'CRYPTO-LAB-LATTICE-IBE-GPV-ID-v1';
const encoder = new TextEncoder();

export interface IdentitySyndrome {
  readonly identity: string;
  readonly bytes: readonly number[];
  readonly syndrome: readonly number[];
  readonly digestHex: string;
  readonly rejectedWords: number;
  readonly blocks: number;
}

export function validateIdentity(identity: string): void {
  if (!/^[\x21-\x7e]{1,96}$/.test(identity)) {
    throw new Error('IDENTITY_FORMAT: use 1-96 printable ASCII bytes without spaces');
  }
}

async function sha256(input: Uint8Array): Promise<Uint8Array> {
  const owned = Uint8Array.from(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', owned.buffer);
  return new Uint8Array(digest);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function counterBytes(counter: number): Uint8Array {
  return Uint8Array.of(
    (counter >>> 24) & 0xff,
    (counter >>> 16) & 0xff,
    (counter >>> 8) & 0xff,
    counter & 0xff,
  );
}

export async function identityToSyndrome(identity: string): Promise<IdentitySyndrome> {
  validateIdentity(identity);
  const identityBytes = encoder.encode(identity);
  const prefix = encoder.encode(IDENTITY_DOMAIN);
  const acceptedLimit = Math.floor(0x1_0000 / Q) * Q;
  const syndrome: number[] = [];
  let rejectedWords = 0;
  let firstDigest: Uint8Array<ArrayBufferLike> = new Uint8Array();
  let counter = 0;
  while (syndrome.length < N) {
    const input = new Uint8Array(prefix.length + 1 + 4 + identityBytes.length);
    input.set(prefix, 0);
    input[prefix.length] = 0;
    input.set(counterBytes(counter), prefix.length + 1);
    input.set(identityBytes, prefix.length + 5);
    const digest = await sha256(input);
    if (counter === 0) firstDigest = digest;
    for (let offset = 0; offset + 1 < digest.length && syndrome.length < N; offset += 2) {
      const word = (digest[offset]! << 8) | digest[offset + 1]!;
      if (word >= acceptedLimit) {
        rejectedWords += 1;
        continue;
      }
      syndrome.push(word % Q);
    }
    counter += 1;
    if (counter > 0xffff) throw new Error('IDENTITY_HASH_CAP');
  }
  return {
    identity,
    bytes: [...identityBytes],
    syndrome,
    digestHex: hex(firstDigest),
    rejectedWords,
    blocks: counter,
  };
}
