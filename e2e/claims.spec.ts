import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const Q = 4093;
const HALF_Q = Math.floor(Q / 2);
const A = [
  [17, 43, 5, 71],
  [29, 11, 64, 3],
] as const;
const DOMAIN = 'CRYPTO-LAB-LATTICE-IBE-GPV-ID-v1';

function mod(value: number): number {
  return ((value % Q) + Q) % Q;
}

function dot(left: readonly number[], right: readonly number[]): number {
  return left.reduce((sum, value, index) => sum + value * right[index]!, 0);
}

function parseVector(text: string): number[] {
  const match = text.match(/\[([^\]]*)\]/);
  if (!match) throw new Error(`No vector in ${text}`);
  return match[1]!.split(',').map((part) => Number(part.trim()));
}

async function ready(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-result-state', 'fresh');
  await expect(page.locator('#results')).toBeVisible();
}

function independentIdentityMap(identity: string): { digest: string; syndrome: number[]; rejected: number; blocks: number } {
  const prefix = Buffer.from(DOMAIN, 'utf8');
  const id = Buffer.from(identity, 'utf8');
  const acceptedLimit = Math.floor(0x1_0000 / Q) * Q;
  const syndrome: number[] = [];
  let digest = '';
  let rejected = 0;
  let counter = 0;
  while (syndrome.length < 2) {
    const count = Buffer.alloc(4);
    count.writeUInt32BE(counter);
    const block = createHash('sha256')
      .update(Buffer.concat([prefix, Buffer.from([0]), count, id]))
      .digest();
    if (counter === 0) digest = block.toString('hex');
    for (let offset = 0; offset + 1 < block.length && syndrome.length < 2; offset += 2) {
      const word = block.readUInt16BE(offset);
      if (word >= acceptedLimit) {
        rejected += 1;
      } else {
        syndrome.push(word % Q);
      }
    }
    counter += 1;
  }
  return { digest, syndrome, rejected, blocks: counter };
}

test('renders a fresh default run and keeps the security boundary visible', async ({ page }) => {
  await ready(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lattice IBE');
  await expect(page.locator('.cl-hero-sub')).toHaveText('GPV IBE · Dual-LWE · Toy Parameters');
  await expect(page.locator('.cl-hero-why-text')).toContainText('central key escrow');
  await expect(page.locator('.cl-hero-why-text')).toContainText('insecure parameters erase the promised protection');
  await expect(page.locator('.scripture-footer')).toContainText('1 Corinthians 10:31');
  await expect(page.locator('.boundary').first()).toContainText('Mechanism toy, not secure parameters');
  await expect(page.locator('[data-host="decrypt-verdict"]')).toContainText('Recovered bit 1');
  await expect(page.locator('[data-host="parameter-ledger"]')).toContainText('not TrapGen / not uniform');
  await expect(page.locator('[data-host="parameter-ledger"]')).toContainText('rank_q(A) = 2');
  await expect(page.locator('[data-host="parameter-ledger"]')).toContainText('not cryptographic');
  await expect(page.getByText(/not an approved deployment scheme/)).toBeVisible();
  await expect(page.getByText(/November 17, 2025 potential-update notice/)).toBeVisible();
});

test('recomputes the identity hash and unbiased syndrome outside the app', async ({ page }) => {
  await ready(page);
  const expected = independentIdentityMap('alice@example.edu');
  await expect(page.locator('[data-host="identity-digest"]')).toHaveText(expected.digest);
  expect(parseVector(await page.locator('[data-host="syndrome"]').innerText())).toEqual(expected.syndrome);
  await expect(page.locator('[data-host="hash-rejections"]'))
    .toHaveText(`${expected.rejected} across ${expected.blocks} SHA-256 block(s)`);
});

test('checks the extracted key against the public equation independently', async ({ page }) => {
  await ready(page);
  const key = parseVector(await page.locator('[data-host="private-key"]').innerText());
  const syndrome = parseVector(await page.locator('[data-host="syndrome"]').innerText());
  expect(A.map((row) => mod(dot(row, key)))).toEqual(syndrome);
  const squaredNorm = key.reduce((sum, value) => sum + value * value, 0);
  expect(Number(await page.locator('[data-host="key-norm"]').innerText())).toBeCloseTo(Math.sqrt(squaredNorm), 3);
  await expect(page.locator('[data-host="cache-result"]')).toHaveText('same cached e returned');
});

test('recomputes both ciphertext coordinates and the decryption residual', async ({ page }) => {
  await ready(page);
  const key = parseVector(await page.locator('[data-host="private-key"]').innerText());
  const syndrome = parseVector(await page.locator('[data-host="syndrome"]').innerText());
  const secret = parseVector(await page.locator('[data-host="encryption-secret"]').innerText());
  const errorsText = await page.locator('[data-host="encryption-errors"]').innerText();
  const errors = parseVector(errorsText);
  const scalarError = Number(errorsText.match(/x′ = (-?\d+)/)?.[1]);
  const ciphertextText = await page.locator('[data-host="ciphertext"]').innerText();
  const p = parseVector(ciphertextText);
  const c = Number(ciphertextText.match(/c = (\d+)/)?.[1]);
  const expectedP = Array.from({ length: 4 }, (_, column) =>
    mod(A[0][column]! * secret[0]! + A[1][column]! * secret[1]! + errors[column]!),
  );
  expect(p).toEqual(expectedP);
  expect(c).toBe(mod(dot(syndrome, secret) + scalarError + HALF_Q));
  const phase = mod(c - dot(key, p));
  const residual = mod(scalarError - dot(key, errors));
  expect(Number((await page.locator('[data-host="phase"]').innerText()).split(';')[0])).toBe(phase);
  await expect(page.locator('[data-host="residual"]')).toHaveText(`${residual} = ${residual}`);
});

test('shows all four executed SampleD rounds in reverse basis order', async ({ page }) => {
  await ready(page);
  const rows = page.locator('[data-host="sample-rounds"] tr');
  await expect(rows).toHaveCount(4);
  expect(await rows.locator('td:first-child').allTextContents()).toEqual(['4', '3', '2', '1']);
  for (const value of await rows.locator('td:nth-child(6)').allTextContents()) {
    expect(Number(value)).toBeGreaterThan(0);
  }
});

test('verifies that the public-search key breaks only the tiny profile', async ({ page }) => {
  await ready(page);
  const result = await page.locator('[data-host="public-search-result"]').innerText();
  expect(result).toContain('Toy break:');
  expect(result).toContain('decoded bit 1');
  const key = parseVector(result);
  const syndrome = parseVector(await page.locator('[data-host="syndrome"]').innerText());
  expect(A.map((row) => mod(dot(row, key)))).toEqual(syndrome);
  await expect(page.locator('[data-host="public-search-copy"]')).toContainText('It never receives T');
});

test('keeps changed-key, changed-identity, wrong-key, and noise controls distinct', async ({ page }) => {
  await ready(page);
  await expect(page.locator('[data-host="changed-identity-result"]')).toContainText('Refused');
  await expect(page.locator('[data-host="mutated-key-result"]')).toContainText('Refused before decryption');
  await expect(page.locator('[data-host="wrong-identity-result"]')).toContainText('no authentication signal');
  await expect(page.locator('[data-host="oversized-result"]')).toContainText('correctness depends on the noise bound');
});

test('retires stale outputs and derives a new run from changed inputs', async ({ page }) => {
  await ready(page);
  const oldSyndrome = await page.locator('[data-host="syndrome"]').innerText();
  await page.locator('#identity').fill('carol@example.edu');
  await expect(page.locator('html')).toHaveAttribute('data-result-state', 'stale');
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#run-status')).toContainText('prior verdict was retired');
  await page.getByRole('button', { name: 'Run the complete profile' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-result-state', 'fresh');
  await expect(page.locator('[data-host="syndrome"]')).not.toHaveText(oldSyndrome);
  const expected = independentIdentityMap('carol@example.edu');
  expect(parseVector(await page.locator('[data-host="syndrome"]').innerText())).toEqual(expected.syndrome);
});

test('shows an error and no stale results for an invalid relation request', async ({ page }) => {
  await ready(page);
  await page.locator('#other-identity').fill('alice@example.edu');
  await page.getByRole('button', { name: 'Run the complete profile' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-result-state', 'error');
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#run-status')).toContainText('SCENARIO_IDENTITIES');
});

test('reruns both message bits instead of pinning one favorable result', async ({ page }) => {
  await ready(page);
  await page.locator('#message-bit').selectOption('0');
  await page.locator('#seed').fill('browser-bit-zero');
  await page.getByRole('button', { name: 'Run the complete profile' }).click();
  await expect(page.locator('[data-host="decrypt-verdict"]')).toContainText('Recovered bit 0');
  await page.locator('#message-bit').selectOption('1');
  await page.locator('#seed').fill('browser-bit-one');
  await page.getByRole('button', { name: 'Run the complete profile' }).click();
  await expect(page.locator('[data-host="decrypt-verdict"]')).toContainText('Recovered bit 1');
});

test('links the claimed systems and primary publications', async ({ page }) => {
  await ready(page);
  const hrefs = await page.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(hrefs).toContain('https://people.csail.mit.edu/cpeikert/pubs/trap_lattice.pdf');
  expect(hrefs).toContain('https://crypto.stanford.edu/~dabo/pubs/papers/latticebb.pdf');
  expect(hrefs).toContain('https://systemslibrarian.github.io/crypto-lab-ibe-gate/');
  expect(hrefs).toContain('https://systemslibrarian.github.io/crypto-lab-attribute-gate/');
  expect(await page.locator('body').innerText()).not.toMatch(/[😀-🙏]/u);
});
