export interface InterfaceComparison {
  readonly system: string;
  readonly address: string;
  readonly extraction: string;
  readonly encryption: string;
  readonly trust: string;
  readonly status: string;
  readonly link: string;
}

export const INTERFACE_COMPARISONS: readonly InterfaceComparison[] = [
  {
    system: 'GPV bounded profile (this lab)',
    address: 'Exact identity bytes map to a syndrome u in Z_q^n.',
    extraction: 'The authority samples and caches a short e with A e = u mod q.',
    encryption: 'Dual-LWE bit ciphertext (A^T s + x, u^T s + x\' + b floor(q/2)).',
    trust: 'The master trapdoor can extract every identity key: full escrow.',
    status: 'Research construction; this four-dimensional profile is not secure or standardized.',
    link: 'https://people.csail.mit.edu/cpeikert/pubs/trap_lattice.pdf',
  },
  {
    system: 'BasicIdent in IBE Gate',
    address: 'Identity bytes hash to a BLS12-381 G1 point.',
    extraction: 'The PKG deterministically returns d_ID = s H_1(ID).',
    encryption: 'Pairing-based KEM-shaped mask from e(H_1(ID), P_pub)^r.',
    trust: 'The master scalar extracts every identity key: full escrow.',
    status: 'Executable pairing lesson; discrete-log/pairing assumptions are not post-quantum.',
    link: 'https://systemslibrarian.github.io/crypto-lab-ibe-gate/',
  },
  {
    system: 'FAME in Attribute Gate',
    address: 'A ciphertext carries an access policy over named attributes.',
    extraction: 'The authority issues randomized user components for an attribute set.',
    encryption: 'Pairing-based CP-ABE KEM into HKDF and AES-GCM.',
    trust: 'The authority can issue satisfying keys: escrow remains.',
    status: 'Executable pairing lesson; it is ABE, not identity-addressed lattice extraction.',
    link: 'https://systemslibrarian.github.io/crypto-lab-attribute-gate/',
  },
];
