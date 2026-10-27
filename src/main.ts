import './style.css';
import { INTERFACE_COMPARISONS } from './comparison.ts';
import { M, N, PUBLIC_MATRIX, Q, TRAPDOOR_BASIS } from './params.ts';
import { DEFAULT_INPUT, runScenario, type ScenarioInput, type ScenarioResult } from './scenario.ts';

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`DOM_MISSING: ${selector}`);
  return element;
}

function host(name: string): HTMLElement {
  return requireElement<HTMLElement>(`[data-host="${name}"]`);
}

function vector(values: readonly number[]): string {
  return `[${values.join(', ')}]`;
}

function matrix(values: readonly (readonly number[])[]): string {
  return values.map((row) => `[ ${row.map((value) => String(value).padStart(4)).join('  ')} ]`).join('\n');
}

function setText(name: string, value: string | number): void {
  host(name).textContent = String(value);
}

function appendCell(row: HTMLTableRowElement, text: string, className = ''): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.textContent = text;
  if (className) cell.className = className;
  row.append(cell);
  return cell;
}

function renderRounds(result: ScenarioResult): void {
  const body = host('sample-rounds');
  body.replaceChildren();
  for (const round of result.extraction.rounds) {
    const row = document.createElement('tr');
    appendCell(row, String(round.basisIndex));
    appendCell(row, round.gramSchmidtNorm.toFixed(3));
    appendCell(row, round.center.toFixed(4));
    appendCell(row, round.width.toFixed(4));
    appendCell(row, String(round.value));
    appendCell(row, String(round.attempts));
    body.append(row);
  }
}

function renderParameters(result: ScenarioResult): void {
  const evidence = result.profile;
  const rows: readonly (readonly [string, string, string, string])[] = [
    ['q is prime', `q = ${Q}`, evidence.primeModulus ? 'exact pass' : 'fail', evidence.primeModulus ? 'status-pass' : 'status-fail'],
    ['T spans the full q-ary kernel', `rank_q(A) = ${N}; |det T| = q^${N}; A Tᵀ = 0`, evidence.completeKernelBasis ? 'exact pass' : 'fail', evidence.completeKernelBasis ? 'status-pass' : 'status-fail'],
    ['SampleD width / max ||b*||', `${evidence.samplerRatio.toFixed(3)}×`, 'bounded mechanism; no asymptotic claim', 'status-warn'],
    ['Ajtai trapdoor-generation dimension', `m = ${M}; cited floor = ${evidence.ajtaiMinimumM}`, evidence.passesAjtaiDimension ? 'met' : 'not met', evidence.passesAjtaiDimension ? 'status-pass' : 'status-fail'],
    ['Dual-system dimension', `m = ${M}; cited floor = ${evidence.dualMinimumM}`, evidence.passesDualDimension ? 'met' : 'not met', evidence.passesDualDimension ? 'status-pass' : 'status-fail'],
    ['Dual-system modulus inequality', `q = ${Q}; 5r(m+1) = ${evidence.dualMinimumQ}`, evidence.passesDualModulus ? 'met' : 'not met', evidence.passesDualModulus ? 'status-pass' : 'status-fail'],
    ['Public matrix distribution', 'fixed 2×4 teaching matrix', 'not TrapGen / not uniform', 'status-fail'],
    ['Encryption error law', 'centered binomial η=1', 'adaptation, not Ψ̄α', 'status-warn'],
    ['Randomness source', 'seeded xorshift32', 'reproducible, not cryptographic', 'status-fail'],
  ];
  const body = host('parameter-ledger');
  body.replaceChildren();
  for (const [check, value, verdict, className] of rows) {
    const row = document.createElement('tr');
    appendCell(row, check);
    appendCell(row, value);
    appendCell(row, verdict, className);
    body.append(row);
  }
}

function renderComparison(): void {
  const body = host('comparison');
  body.replaceChildren();
  for (const item of INTERFACE_COMPARISONS) {
    const row = document.createElement('tr');
    const system = document.createElement('td');
    const link = document.createElement('a');
    link.href = item.link;
    link.textContent = item.system;
    system.append(link);
    row.append(system);
    appendCell(row, item.address);
    appendCell(row, item.extraction);
    appendCell(row, item.encryption);
    appendCell(row, `${item.trust} ${item.status}`);
    body.append(row);
  }
}

function render(result: ScenarioResult): void {
  setText('identity-bytes', vector(result.identity.bytes));
  setText('identity-digest', result.identity.digestHex);
  setText('syndrome', vector(result.identity.syndrome));
  setText('hash-rejections', `${result.identity.rejectedWords} across ${result.identity.blocks} SHA-256 block(s)`);
  setText('public-matrix', matrix(PUBLIC_MATRIX));
  setText('trapdoor-basis', matrix(TRAPDOOR_BASIS));
  setText('representative', vector(result.extraction.representative));
  setText('lattice-vector', vector(result.extraction.latticeVector));
  setText('private-key', vector(result.extraction.key));
  setText('key-relation', `${vector(result.extraction.relation)} = u`);
  setText('key-norm', result.extraction.keyNorm.toFixed(3));
  setText('cache-result', result.repeatedExtraction.cacheHit ? 'same cached e returned' : 'unexpected resample');
  renderRounds(result);

  setText('encryption-secret', vector(result.ciphertext.secret));
  setText('encryption-errors', `${vector(result.ciphertext.vectorError)}; x′ = ${result.ciphertext.scalarError}`);
  setText('ciphertext', `p = ${vector(result.ciphertext.p)}; c = ${result.ciphertext.c}`);
  setText('phase', `${result.decryption.phase}; distances ${result.decryption.distanceToZero} to 0 and ${result.decryption.distanceToHalf} to floor(q/2)`);
  setText('residual', `${result.residual.fromCiphertext} = ${result.residual.fromErrors}`);
  const verdict = host('decrypt-verdict');
  const decrypts = result.decryption.bit === result.input.bit;
  verdict.dataset.outcome = decrypts ? 'pass' : 'fail';
  verdict.textContent = decrypts
    ? `Recovered bit ${result.decryption.bit}. The current-run relation and noise stayed inside the decoding region.`
    : `Recovered bit ${result.decryption.bit}, not ${result.input.bit}. This run crossed the toy decoding boundary.`;

  setText(
    'public-search-copy',
    `Using only A, q, u and coordinate bound ${result.publicSearch.bound}, a meet-in-the-middle search checked ${result.publicSearch.operations.toLocaleString()} pair states. It never receives T.`,
  );
  setText(
    'public-search-result',
    result.publicSearch.key && result.publicSearchDecryption
      ? `Toy break: ${result.publicSearch.matches} retained candidate(s); e = ${vector(result.publicSearch.key)}, ||e|| = ${result.publicSearch.keyNorm?.toFixed(3)}, decoded bit ${result.publicSearchDecryption.bit}.`
      : 'No bounded preimage found; this would be an incomplete search, not security evidence.',
  );
  setText(
    'changed-identity-copy',
    `${result.otherIdentity.identity} maps to u = ${vector(result.otherIdentity.syndrome)}. The first key is checked against that new public target.`,
  );
  setText(
    'changed-identity-result',
    result.primaryKeyMatchesOtherIdentity ? 'Unexpectedly accepted.' : 'Refused: A e does not equal the changed syndrome.',
  );
  setText('mutated-key-copy', `The first coordinate changes by +1: ${vector(result.mutatedKey)}.`);
  setText(
    'mutated-key-result',
    result.mutatedKeyAccepted ? 'Unexpectedly accepted.' : 'Refused before decryption: the public preimage equation fails.',
  );
  setText(
    'wrong-identity-copy',
    `The valid key for ${result.otherIdentity.identity} is nevertheless fed to the bare one-bit decoder.`,
  );
  setText(
    'wrong-identity-result',
    `It outputs bit ${result.wrongIdentityDecryption.bit}. GPV's CPA bit primitive has no authentication signal, so an output is not proof of the right key.`,
  );
  setText(
    'oversized-copy',
    `The scalar error is set to floor(q/2) = ${result.oversizedCiphertext.scalarError}, outside the declared teaching error law.`,
  );
  setText(
    'oversized-result',
    `Decoded bit ${result.oversizedDecryption.bit} instead of ${result.input.bit}; correctness depends on the noise bound.`,
  );
  renderParameters(result);
}

const form = requireElement<HTMLFormElement>('#scenario-form');
const runButton = requireElement<HTMLButtonElement>('#run');
const status = requireElement<HTMLElement>('#run-status');
const results = requireElement<HTMLElement>('#results');
const identityInput = requireElement<HTMLInputElement>('#identity');
const otherIdentityInput = requireElement<HTMLInputElement>('#other-identity');
const bitInput = requireElement<HTMLSelectElement>('#message-bit');
const seedInput = requireElement<HTMLInputElement>('#seed');
let lastCommitted = '';

function readInput(): ScenarioInput {
  return {
    identity: identityInput.value,
    otherIdentity: otherIdentityInput.value,
    bit: bitInput.value === '0' ? 0 : 1,
    seed: seedInput.value,
  };
}

function inputFingerprint(): string {
  return JSON.stringify(readInput());
}

function retireIfChanged(): void {
  if (lastCommitted && inputFingerprint() !== lastCommitted) {
    document.documentElement.dataset.resultState = 'stale';
    results.hidden = true;
    status.textContent = 'Inputs changed. The prior verdict was retired; run the profile again.';
  }
}

for (const control of [identityInput, otherIdentityInput, bitInput, seedInput]) {
  control.addEventListener('input', retireIfChanged);
  control.addEventListener('change', retireIfChanged);
}

async function execute(input: ScenarioInput): Promise<void> {
  runButton.disabled = true;
  form.setAttribute('aria-busy', 'true');
  status.textContent = 'Computing hash, trapdoor sample, ciphertext, controls, and independent checks.';
  try {
    const result = await runScenario(input);
    render(result);
    lastCommitted = JSON.stringify(input);
    results.hidden = false;
    document.documentElement.dataset.resultState = 'fresh';
    status.textContent = `Fresh result for ${input.identity}; all displayed values come from this run.`;
  } catch (error) {
    results.hidden = true;
    document.documentElement.dataset.resultState = 'error';
    status.textContent = error instanceof Error ? error.message : 'The run failed.';
  } finally {
    runButton.disabled = false;
    form.removeAttribute('aria-busy');
    document.documentElement.dataset.appReady = 'true';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void execute(readInput());
});

renderComparison();
identityInput.value = DEFAULT_INPUT.identity;
otherIdentityInput.value = DEFAULT_INPUT.otherIdentity;
bitInput.value = String(DEFAULT_INPUT.bit);
seedInput.value = DEFAULT_INPUT.seed;
void execute(DEFAULT_INPUT);
