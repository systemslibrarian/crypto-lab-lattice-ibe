#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vitest = join(root, 'node_modules', '.bin', 'vitest');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const mutations = [
  {
    name: 'identity domain separation silently changes',
    file: 'src/hash.ts',
    from: "export const IDENTITY_DOMAIN = 'CRYPTO-LAB-LATTICE-IBE-GPV-ID-v1';",
    to: "export const IDENTITY_DOMAIN = 'CRYPTO-LAB-LATTICE-IBE-GPV-ID-v2';",
    suite: 'src/hash.test.ts',
    test: 'uses SHA-256 over the declared domain-separated bytes',
  },
  {
    name: 'identity hash adds one after rejection sampling',
    file: 'src/hash.ts',
    from: 'syndrome.push(word % Q);',
    to: 'syndrome.push((word + 1) % Q);',
    suite: 'src/hash.test.ts',
    test: 'uses SHA-256 over the declared domain-separated bytes',
  },
  {
    name: 'public matrix no longer matches the trapdoor basis',
    file: 'src/params.ts',
    from: '  [17, 43, 5, 71],',
    to: '  [18, 43, 5, 71],',
    suite: 'src/trapdoor.test.ts',
    test: 'proves the basis is the complete kernel',
  },
  {
    name: 'Ajtai dimension floor loses one n log q factor',
    file: 'src/trapdoor.ts',
    from: 'const ajtaiMinimumM = Math.ceil(5 * N * logQ);',
    to: 'const ajtaiMinimumM = Math.ceil(4 * N * logQ);',
    suite: 'src/trapdoor.test.ts',
    test: 'proves the basis is the complete kernel',
  },
  {
    name: 'dual-system dimension floor gains an unsupported factor',
    file: 'src/trapdoor.ts',
    from: 'const dualMinimumM = Math.ceil(2 * N * logQ);',
    to: 'const dualMinimumM = Math.ceil(3 * N * logQ);',
    suite: 'src/trapdoor.test.ts',
    test: 'proves the basis is the complete kernel',
  },
  {
    name: 'dual-system modulus inequality drops its factor five',
    file: 'src/trapdoor.ts',
    from: 'const dualMinimumQ = 5 * GAUSSIAN_R * (M + 1);',
    to: 'const dualMinimumQ = 4 * GAUSSIAN_R * (M + 1);',
    suite: 'src/trapdoor.test.ts',
    test: 'proves the basis is the complete kernel',
  },
  {
    name: 'SampleZ exponent rewards distant integers',
    file: 'src/trapdoor.ts',
    from: 'const acceptance = Math.exp(-Math.PI * normalized * normalized);',
    to: 'const acceptance = Math.exp(Math.PI * normalized * normalized);',
    suite: 'src/trapdoor.test.ts',
    test: 'runs SampleZ in the declared finite rejection window',
  },
  {
    name: 'SampleISIS subtracts the kernel vector from its representative',
    file: 'src/trapdoor.ts',
    from: 'const key = add(representative, sampled.latticeVector);',
    to: 'const key = subtract(representative, sampled.latticeVector);',
    suite: 'src/trapdoor.test.ts',
    test: 'extracts different short preimages',
  },
  {
    name: 'public search adds instead of subtracting the right contribution',
    file: 'src/trapdoor.ts',
    from: 'mod(normalizedSyndrome[0]! - right[0]!, Q),',
    to: 'mod(normalizedSyndrome[0]! + right[0]!, Q),',
    suite: 'src/trapdoor.test.ts',
    test: 'finds a toy preimage without receiving the trapdoor',
  },
  {
    name: 'dual ciphertext p subtracts its error vector',
    file: 'src/ibe.ts',
    from: 'mod(dot(column, secret) + vectorError[index]!, Q),',
    to: 'mod(dot(column, secret) - vectorError[index]!, Q),',
    suite: 'src/ibe.test.ts',
    test: 'computes p and c from the displayed secret and errors',
  },
  {
    name: 'dual ciphertext c omits message encoding',
    file: 'src/ibe.ts',
    from: 'const c = mod(dot(syndrome, secret) + scalarError + bit * HALF_Q, Q);',
    to: 'const c = mod(dot(syndrome, secret) + scalarError, Q);',
    suite: 'src/ibe.test.ts',
    test: 'computes p and c from the displayed secret and errors',
  },
  {
    name: 'decoder chooses the farther code point',
    file: 'src/ibe.ts',
    from: 'bit: distanceToZero <= distanceToHalf ? 0 : 1,',
    to: 'bit: distanceToZero >= distanceToHalf ? 0 : 1,',
    suite: 'src/ibe.test.ts',
    test: 'round-trips both bits across a seed census',
  },
  {
    name: 'residual adds the vector-error inner product',
    file: 'src/ibe.ts',
    from: 'const fromErrors = mod(ciphertext.scalarError - dot(key, ciphertext.vectorError), Q);',
    to: 'const fromErrors = mod(ciphertext.scalarError + dot(key, ciphertext.vectorError), Q);',
    suite: 'src/ibe.test.ts',
    test: 'derives the same residual by two independent routes',
  },
  {
    name: 'stateful extractor ignores its cached private key',
    file: 'src/scenario.ts',
    from: 'if (cached) return { ...cached, cacheHit: true };',
    to: "if (cached && mapping.identity === '') return { ...cached, cacheHit: true };",
    suite: 'src/scenario.test.ts',
    test: 'caches one sampled key per exact identity',
  },
];

const touched = [...new Set(mutations.map((mutation) => join(root, mutation.file)))];
const originals = new Map(touched.map((file) => [file, readFileSync(file)]));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

function run(command, args) {
  return spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
}

function restoreAll() {
  for (const [file, bytes] of originals) writeFileSync(file, bytes);
}

function assertRestored() {
  for (const [file, bytes] of originals) {
    if (digest(readFileSync(file)) !== digest(bytes)) {
      throw new Error(`${relative(root, file)} was not restored byte for byte`);
    }
  }
}

function treeDigest(directory) {
  const hash = createHash('sha256');
  const visit = (path) => {
    for (const entry of readdirSync(path).sort()) {
      const file = join(path, entry);
      if (statSync(file).isDirectory()) visit(file);
      else {
        hash.update(relative(directory, file));
        hash.update(readFileSync(file));
      }
    }
  };
  visit(directory);
  return hash.digest('hex');
}

function requireSuccess(result, message) {
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(message);
  }
}

let caught = 0;
try {
  const baseline = run(vitest, ['run']);
  requireSuccess(baseline, 'baseline: unmutated copy FAILED; mutation results below would be meaningless');
  const baselineBuild = run(npm, ['run', 'build']);
  requireSuccess(baselineBuild, 'baseline build FAILED; mutation bundle checks would be meaningless');
  const cleanBundle = treeDigest(join(root, 'dist'));
  console.log('baseline: unmutated copy PASSES');

  for (const mutation of mutations) {
    const file = join(root, mutation.file);
    const originalText = originals.get(file).toString('utf8');
    const occurrences = originalText.split(mutation.from).length - 1;
    if (occurrences !== 1) {
      throw new Error(`${mutation.name}: expected one source anchor, found ${occurrences}`);
    }
    writeFileSync(file, originalText.replace(mutation.from, mutation.to));

    const result = run(vitest, ['run', mutation.suite, '-t', mutation.test]);
    if (result.status === 0) {
      process.stderr.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
      throw new Error(`SURVIVED: ${mutation.name}`);
    }
    const build = run(npm, ['run', 'build']);
    requireSuccess(build, `mutated build failed instead of producing testable output: ${mutation.name}`);
    if (treeDigest(join(root, 'dist')) === cleanBundle) {
      throw new Error(`mutation did not reach the production bundle: ${mutation.name}`);
    }
    writeFileSync(file, originals.get(file));
    caught += 1;
    console.log(`caught ${caught}/${mutations.length}: ${mutation.name}`);
  }

  assertRestored();
  const finalBaseline = run(vitest, ['run']);
  requireSuccess(finalBaseline, 'restored source does not pass its clean baseline');
  const finalBuild = run(npm, ['run', 'build']);
  requireSuccess(finalBuild, 'restored source does not build');
  if (treeDigest(join(root, 'dist')) !== cleanBundle) {
    throw new Error('restored production bundle differs from the clean baseline');
  }
  console.log(`all ${caught} mutation(s) caught; sources and production bundle restored byte for byte`);
} finally {
  restoreAll();
  assertRestored();
}
