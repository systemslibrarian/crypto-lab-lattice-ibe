# Lattice IBE

## What It Is

Lattice IBE is a bounded, executable lesson for the random-oracle identity-based encryption construction of Gentry, Peikert, and Vaikuntanathan (GPV). It maps exact identity bytes to a public lattice syndrome, uses a short basis of the complete q-ary kernel to sample a private preimage, and runs the paper's dual-LWE bit-encryption equations.

Identity-based encryption lets a sender address ciphertext to an identity such as an email address without first retrieving that recipient's certificate. It also creates central key escrow: the authority holding the master trapdoor can derive every recipient key. This lab makes both the mechanism and that trust boundary visible.

Every displayed value comes from the current browser run. The fixed `n = 2`, `m = 4` profile is intentionally insecure: it fails the source theorem's dimension and distribution requirements, and the page demonstrates a successful public preimage search. This is a mechanism lesson, not production cryptography, an approved post-quantum profile, or a security proof.

## Exhibits

1. **Identity to syndrome** — hash exact printable-ASCII identity bytes with a named SHA-256 domain and unbiased rejection sampling to obtain `u in Z_q^n`.
2. **Central key extraction** — solve for a coset representative, run four visible GPV `SampleD` rounds, return `e = t + v`, and independently verify `A e = u mod q`.
3. **Dual-LWE encryption** — execute `p = A^T s + x` and `c = u^T s + x' + b floor(q / 2)`, then compare the decryption residual by two routes.
4. **Failure controls** — try a changed identity, a mutated key, a valid key for the wrong identity, and an oversized error without collapsing their different outcomes into one generic failure.
5. **Public toy break** — give a meet-in-the-middle search only `(A, q, u)` and a coordinate bound, recover a working private preimage, and decrypt independently with it.
6. **Parameter and interface boundary** — compare the current profile with the paper's prerequisites and place its extraction interface beside the existing BasicIdent and FAME lessons.

The public matrix is `A in Z_q^(n x m)` with prime `q = 4093`, `n = 2`, and `m = 4`. A fixed short row basis `T` is checked at runtime and in tests: an invertible two-column minor proves `rank_q(A) = n`, `A T^T = 0 mod q`, and `|det T| = q^n`. Together those facts prove that `T` spans the complete kernel `Lambda_q^perp(A)` rather than merely a sublattice.

Extraction follows GPV `SampleISIS`:

1. Solve `A t = u mod q` for an arbitrary coset representative `t`.
2. Run randomized nearest plane `SampleD(T, r, -t)` with the GPV one-dimensional weight `exp(-pi (z-c)^2 / s^2)`.
3. Return `e = t + v` and verify `A e = u mod q`.

The extractor caches the first sampled key for each exact identity, matching the stateful extractor described in GPV section 7.2. A newly initialized authority can return another valid preimage for the same syndrome.

## When to Use It

Use this lab to study how a GPV-style authority maps an identity to a lattice target, how trapdoor preimage sampling supplies the corresponding private key, and how dual-LWE encryption consumes that relation. It is also useful for comparing lattice extraction with pairing-based IBE and attribute-based encryption.

Do **not** use this code, its parameters, its deterministic randomness, or its one-bit ciphertext format to protect data. Do not treat the successful round trip as evidence that the toy profile is post-quantum secure.

## Live Demo

Open <https://systemslibrarian.github.io/crypto-lab-lattice-ibe/>. Choose two exact identities, a message bit, and a reproducible teaching seed; then run the complete profile and inspect the hash, sampled key, ciphertext equations, public attack, negative controls, and parameter ledger.

## What Can Go Wrong

- The public bounded search finds a working private preimage because the dimensions are deliberately tiny.
- A changed identity produces a different target, so the first identity's key fails the public relation.
- A one-coordinate key mutation is rejected by `A e = u mod q` before decryption.
- A valid key for the wrong identity still makes the unauthenticated bit decoder output a bit; that output is not an authentication signal.
- An oversized scalar error flips the decoded bit, demonstrating that correctness depends on the noise bound.
- Changing any input retires the old result immediately. Invalid or equal identities produce a named error and no stale verdict.

The profile has a valid prime modulus and a complete q-ary-kernel basis, but it does not meet the cited asymptotic floors `m >= 5 n lg q` for the trapdoor-generation context or `m >= 2 n lg q` for the dual system. It also uses a fixed matrix rather than `TrapGen`, a deterministic xorshift generator rather than cryptographic randomness, and centered-binomial teaching errors instead of GPV's discretized normal distribution.

## Real-World Usage

IBE systems replace certificate lookup with authority-mediated key extraction. That can simplify addressing, but it makes the private-key generator a high-value escrow authority whose compromise affects every identity it serves. Enrollment, revocation, auditing, distributed trust, and key lifecycle controls are therefore deployment questions, not details that the algebra resolves automatically.

“Post-quantum” describes the source construction under its LWE/SIS assumptions and parameter hypotheses. NIST's current post-quantum portfolio contains KEMs and signatures; this GPV IBE profile is not an approved deployment scheme, and ML-KEM is not a drop-in replacement for identity- or policy-derived private-key extraction. The official FIPS 203 page carries a November 17, 2025 notice that potential updates have been identified; this lesson uses FIPS 203 only to establish that ML-KEM is a KEM, not any potentially affected algorithm detail.

## How to Run Locally

Use Node.js 22, 24, or 26 and npm 10.9 or newer.

```sh
npm ci
npm run dev
```

The app is entirely client-side and retains no learner data.

## Related Demos

- [IBE Gate](https://systemslibrarian.github.io/crypto-lab-ibe-gate/) maps an identity to a BLS12-381 point and executes pairing-based BasicIdent.
- [Attribute Gate](https://systemslibrarian.github.io/crypto-lab-attribute-gate/) encrypts to an access policy and issues randomized FAME keys for attribute sets.
- [GGH Trapdoor](https://systemslibrarian.github.io/crypto-lab-ggh-trapdoor/) develops good-basis and bad-basis lattice intuition.
- [Lattice Gentle](https://systemslibrarian.github.io/crypto-lab-lattice-gentle/) introduces LWE, SIS, and small lattice examples before this extraction lesson.

BasicIdent and FAME are pairing lessons and are not post-quantum. All three authority-mediated interfaces place key-issuance power in a central authority.

## Build & Verify

```sh
npm ci
npm run test:coverage
npm run build
npm run test:claims
npm run test:a11y
npm run test:mutations
```

The verified baseline contains 37 unit tests, 11 learner-claim browser checks, five accessibility/reflow/keyboard checks, and 14 named source mutations. The coverage gate requires at least 95% statements, 90% branches, 95% functions, and 95% lines. Browser claim tests recompute the rendered hash, matrix relation, ciphertext equations, and control outcomes independently. The mutation gate first requires an unmodified baseline, then proves that each named corruption is caught and restores the source bytes exactly.

## Performance

The public attack is intentionally bounded and practical only because the profile has four key coordinates and a declared small search bound. No runtime or storage measurement here estimates a secure GPV deployment. The page supplies no concrete lattice estimator, production parameter set, side-channel analysis, or throughput claim.

## Primary Sources and Versions

- Craig Gentry, Chris Peikert, and Vinod Vaikuntanathan, “Trapdoors for Hard Lattices and New Cryptographic Constructions,” STOC 2008, author-hosted full version, especially sections 2.5, 4.1–4.2, 5.3.1–5.3.2, and 7.1–7.2: <https://people.csail.mit.edu/cpeikert/pubs/trap_lattice.pdf>
- Shweta Agrawal, Dan Boneh, and Xavier Boyen, “Efficient Lattice (H)IBE in the Standard Model,” EUROCRYPT 2010 full version, sections 4–7: <https://crypto.stanford.edu/~dabo/pubs/papers/latticebb.pdf>. This source delimits the unimplemented standard-model HIBE route; the lab does not claim its FRD encoding or `SampleLeft`/`SampleRight` algorithms.
- Xavier Boyen, “Post-quantum Identity-Based Encryption and Attribute-Based Encryption,” *Encyclopedia of Cryptography, Security and Privacy*, DOI `10.1007/978-3-030-71522-9_1464`, source PDF original pages 4580–4584: <https://doi.org/10.1007/978-3-030-71522-9_1464>
- NIST, Post-Quantum Cryptography selected algorithms: <https://csrc.nist.gov/projects/post-quantum-cryptography/post-quantum-cryptography-standardization/selected-algorithms>
- NIST FIPS 203, Module-Lattice-Based Key-Encapsulation Mechanism Standard: <https://csrc.nist.gov/pubs/fips/203/final>

The source-reading and design record is retained in [`brief.md`](brief.md).

## Retained Limitations

This lab does not implement secure `TrapGen`, production dimensions, a concrete security estimate, QROM analysis, CCA security, authentication, multi-bit KEM/DEM composition, ABE policies, enrollment, revocation, constant-time arithmetic, secure memory handling, or a deployment profile. Its seeded randomness is deterministic and exists only so tests and learners can reproduce one run. The omniscient teaching view exposes the master basis; the public-search control is separately implemented and receives no trapdoor input.

The project is educational software released under the MIT License, not cryptographic advice or a production library.

---

*One of the browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
