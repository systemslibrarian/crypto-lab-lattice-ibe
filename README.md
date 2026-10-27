# Lattice IBE

Lattice IBE is a bounded, executable lesson for the random-oracle identity-based encryption construction of Gentry, Peikert, and Vaikuntanathan (GPV). It maps exact identity bytes to a public syndrome, uses a short basis of a complete q-ary kernel to sample a private preimage, and runs the paper's dual-LWE bit-encryption equations. Every displayed value comes from the current browser run. The fixed `n = 2`, `m = 4` profile is intentionally insecure: it fails the source theorem's dimension and distribution requirements, and the page demonstrates a successful public preimage search. This is a mechanism lesson, not a deployable IBE system or an approved post-quantum profile.

Live demo: <https://systemslibrarian.github.io/crypto-lab-lattice-ibe/>

## What the lesson executes

The public matrix is `A in Z_q^(n x m)` with prime `q = 4093`, `n = 2`, and `m = 4`. A fixed short row basis `T` is checked at runtime and in tests: an invertible two-column minor proves `rank_q(A) = n`, `A T^T = 0 mod q`, and `|det T| = q^n`. Together those facts prove that `T` spans the complete kernel `Lambda_q^perp(A)` rather than merely a sublattice.

For an identity `ID`, the profile computes a domain-separated SHA-256 stream and uses unbiased 16-bit rejection sampling to obtain `u in Z_q^n`. GPV treats the identity map as a random oracle. This concrete map is an inspectable teaching adaptation; it does not transfer the random-oracle proof to SHA-256.

Extraction follows GPV `SampleISIS`:

1. Solve `A t = u mod q` for an arbitrary coset representative `t`.
2. Run randomized nearest plane `SampleD(T, r, -t)` with the GPV one-dimensional weight `exp(-pi (z-c)^2 / s^2)`.
3. Return `e = t + v` and verify `A e = u mod q`.

The extractor caches the first sampled key for each exact identity, matching the stateful extractor described in GPV section 7.2. A newly initialized authority can return another valid preimage for the same syndrome.

Encryption samples public randomness and executes:

```text
p = A^T s + x                     mod q
c = u^T s + x' + b floor(q / 2)  mod q
```

Decryption compares `c - e^T p mod q` with `0` and `floor(q/2)`. The browser shows the residual both from the ciphertext and independently from `x' - e^T x`. The profile uses centered-binomial teaching errors with parameter one instead of GPV's discretized normal distribution, and labels that substitution next to the computation.

## Failure controls

- A meet-in-the-middle search receives only `(A, q, u)` and a coordinate bound. It finds a working private preimage at the toy dimensions and independently decrypts the current ciphertext.
- A second exact identity maps to a different target; the first identity's key fails that public relation.
- A one-coordinate key mutation is rejected by `A e = u mod q` before decryption.
- A valid key for the wrong identity still makes the unauthenticated bit decoder output a bit. The page does not mislabel that output as an authenticated failure signal.
- An oversized scalar error flips the decoded bit, demonstrating that correctness depends on the error bound.
- Changing any input immediately hides the prior result. Invalid or equal identities produce a named error and no stale verdict.

## Parameter boundary

The page separately reports exact algebraic facts and failed security prerequisites. This profile has a valid prime modulus and a complete q-ary-kernel basis, but it does not meet the cited asymptotic floors `m >= 5 n lg q` for the trapdoor generation context or `m >= 2 n lg q` for the dual system. It also uses a fixed matrix rather than `TrapGen`, a deterministic xorshift generator rather than cryptographic randomness, and a different encryption-error law. No concrete estimator or production parameter set is supplied.

“Post-quantum” describes the source construction under its LWE/SIS assumptions and parameter hypotheses. It is not a security claim for this run. NIST's current post-quantum portfolio includes KEMs and signatures; this GPV IBE profile is not an approved deployment scheme, and ML-KEM is not a drop-in replacement for identity- or policy-derived private-key extraction. The official FIPS 203 page carries a November 17, 2025 notice that potential updates have been identified; this lesson uses FIPS 203 only to establish that ML-KEM is a KEM, not any potentially affected algorithm detail.

## Interface comparison

The final table compares three authority-mediated interfaces without collapsing them:

- This GPV profile maps identity bytes to a lattice syndrome and samples a short preimage.
- [IBE Gate](https://systemslibrarian.github.io/crypto-lab-ibe-gate/) maps an identity to a BLS12-381 point and executes pairing-based BasicIdent.
- [Attribute Gate](https://systemslibrarian.github.io/crypto-lab-attribute-gate/) encrypts to an access policy and issues randomized FAME keys for attribute sets.

All three place key-issuance power in a central authority. BasicIdent and FAME are pairing lessons and are not post-quantum. The bounded GPV route uses lattice algebra, but this page's parameters are not secure.

## Primary sources and versions

- Craig Gentry, Chris Peikert, and Vinod Vaikuntanathan, “Trapdoors for Hard Lattices and New Cryptographic Constructions,” STOC 2008, author-hosted full version, especially sections 2.5, 4.1–4.2, 5.3.1–5.3.2, and 7.1–7.2: <https://people.csail.mit.edu/cpeikert/pubs/trap_lattice.pdf>
- Shweta Agrawal, Dan Boneh, and Xavier Boyen, “Efficient Lattice (H)IBE in the Standard Model,” EUROCRYPT 2010 full version, sections 4–7: <https://crypto.stanford.edu/~dabo/pubs/papers/latticebb.pdf>. This source is used to delimit the unimplemented standard-model HIBE route; the lab does not claim to implement its FRD encoding or `SampleLeft`/`SampleRight` algorithms.
- Xavier Boyen, “Post-quantum Identity-Based Encryption and Attribute-Based Encryption,” *Encyclopedia of Cryptography, Security and Privacy*, DOI `10.1007/978-3-030-71522-9_1464`, source PDF original pages 4580–4584: <https://doi.org/10.1007/978-3-030-71522-9_1464>
- NIST, Post-Quantum Cryptography selected algorithms: <https://csrc.nist.gov/projects/post-quantum-cryptography/post-quantum-cryptography-standardization/selected-algorithms>
- NIST FIPS 203, Module-Lattice-Based Key-Encapsulation Mechanism Standard: <https://csrc.nist.gov/pubs/fips/203/final>

The source-reading and design record is retained in [`brief.md`](brief.md).

## Retained limitations

This lab does not implement secure `TrapGen`, production dimensions, a concrete security estimate, QROM analysis, CCA security, authentication, multi-bit KEM/DEM composition, ABE policies, enrollment, revocation, constant-time arithmetic, secure memory handling, or a deployment profile. Its seeded randomness is deterministic and exists only so tests and learners can reproduce one run. The omniscient teaching view exposes the master basis; the public-search control is separately implemented and receives no trapdoor input.

## Local verification

Use Node.js 22, 24, or 26 and npm 10.9 or newer.

```sh
npm ci
npm run test:coverage
npm run build
npm run test:claims
npm run test:a11y
npm run test:mutations
```

The coverage gate requires at least 95% statements, 90% branches, 95% functions, and 95% lines. Browser claim tests recompute the rendered hash, matrix relation, ciphertext equations, and control outcomes independently. Accessibility tests cover keyboard operation, WCAG A/AA checks, and reflow at desktop, 380-pixel, and 280-pixel viewports. The mutation gate first requires an unmodified baseline, then proves that named source corruptions are caught and restores the source bytes exactly.

## Repository scope

The app is entirely client-side and retains no learner data. It is MIT licensed. The lesson is educational software, not cryptographic advice or a production library.
