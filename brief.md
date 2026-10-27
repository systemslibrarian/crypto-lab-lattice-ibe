# L-R-12 design record — bounded GPV lattice IBE

Date: 2026-10-27

## Decision

Implement the random-oracle lattice IBE of Gentry, Peikert and Vaikuntanathan (GPV), STOC 2008, as a deliberately tiny executable teaching profile. The lesson follows the paper's identity-to-syndrome, trapdoor preimage extraction and dual-LWE bit-encryption equations. It does not claim the paper's security theorem for the toy parameters.

Do not implement Agrawal–Boneh–Boyen's 2010 standard-model HIBE in this milestone. ABB adds full-rank-difference identity matrices, `SampleLeft`/`SampleRight`, substantially larger matrices and different proof machinery. Replacing those prerequisites with labels would make a smaller page look more complete than it is. ABB remains a comparison and extension route, not an implementation claim.

## Primary sources read

- Gentry, Peikert and Vaikuntanathan, “Trapdoors for Hard Lattices and New Cryptographic Constructions,” author-hosted August 25, 2008 full paper: §§2.5, 4.1–4.2, 5.3.1–5.3.2 and 7.1–7.2. The implemented equations are `f_A(e)=Ae mod q`, `SampleISIS(A,T,r,u)`, dual encryption `(p,c)=(A^T s+x, u^T s+x'+b floor(q/2))`, and decoding from `c-e^T p`.
- Agrawal, Boneh and Boyen, “Efficient Lattice (H)IBE in the Standard Model,” full version: §§4–7. Read to distinguish the unimplemented FRD/left-right construction from GPV.
- Xavier Boyen, “Post-quantum Identity-Based Encryption and Attribute-Based Encryption,” Encyclopedia of Cryptography, Security and Privacy, DOI `10.1007/978-3-030-71522-9_1464`, original PDF pp. 4580–4584.
- NIST's current PQC selected-algorithm and FIPS 203 pages, rechecked October 27, 2026. Their standardized/selected portfolio is KEM and signature work; this GPV IBE lesson is not an approved deployment scheme, and ML-KEM is not identity-based key extraction. The FIPS 203 page's November 17, 2025 potential-update notice is carried into the learner UI; this lesson relies only on the document's KEM classification.

## Executable profile

- `q=4093` (prime), `n=2`, `m=4`.
- Fixed public `A` and a fixed short basis `T` for `Lambda_q^perp(A)`. Runtime checks prove an invertible two-column minor and hence `rank_q(A) = n`, together with `A T^T = 0 mod q` and `|det T| = q^n`; these facts show that `T` spans the complete q-ary kernel rather than merely a sublattice.
- SHA-256 plus rejection sampling maps a UTF-8 identity to `u in Z_q^n`. This is a deterministic teaching instantiation, not a programmable random oracle.
- Extraction computes an arbitrary coset representative `t`, runs GPV's randomized-nearest-plane `SampleD(T,r,-t)` with a finite `SampleZ` window, and returns `e=t+v`. Every result is checked against `Ae=u mod q`.
- The one-dimensional sampler uses the paper's `exp(-pi (z-c)^2/s^2)` weight inside an eight-width rejection window. The finite truncation is a declared teaching adaptation; no statistical-distance bound is claimed for it.
- Encryption and decryption execute the paper's dual equations. The teaching error distribution is centered binomial with parameter one, not the paper's discretized normal `Psi_bar_alpha`; that substitution is always visible.
- Repeated extraction is cached per identity, as GPV §7.2 requires. A reset authority can sample a different valid preimage.
- A public meet-in-the-middle search finds a short preimage using only `(A,u,q)` at these dimensions. That failure control is learner-visible and prevents the toy from being mistaken for secure parameters.

## Explicit non-claims

- No Ajtai `TrapGen`, statistically uniform public matrix, concrete security estimate, random-oracle proof transfer, QROM claim, CCA security, authentication, multi-bit KEM/DEM, ABE policy, constant-time behavior or production deployment claim.
- The profile fails the paper's asymptotic dimension requirements (`m >= 5n lg q` for the cited trapdoor generation and `m >= 2n lg q` for the dual system). It also substitutes a fixed matrix, deterministic classroom RNG and CBD1 encryption errors.
- “Post-quantum” describes the source construction's LWE/SIS basis under its hypotheses. It is not a security label for this four-dimensional run.

## Acceptance and negative evidence

1. Identity bytes visibly map to the exact syndrome used by extraction and encryption.
2. The trapdoor sampler's per-round centers, widths, sampled integers and rejection counts are shown.
3. The extracted key relation and the decryption residual are independently recomputed in unit and browser tests.
4. A changed identity, one-coordinate key mutation, public toy search, wrong-identity decode and oversized-error case delimit the claim.
5. The interface table contrasts GPV with the current BasicIdent and FAME labs without claiming that ML-KEM substitutes for either.
6. Focused mutations must alter the built bundle, fail a named owning test, restore the exact source bytes and leave the clean baseline passing.
