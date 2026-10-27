import type { Mat } from './types.ts';

export const Q = 4093;
export const N = 2;
export const M = 4;
export const GAUSSIAN_R = 256;
export const SAMPLE_TAU = 8;
export const PUBLIC_SEARCH_BOUND = 64;
export const HALF_Q = Math.floor(Q / 2);

export const PUBLIC_MATRIX: Mat = [
  [17, 43, 5, 71],
  [29, 11, 64, 3],
];

/** Row basis of the complete q-ary kernel Lambda_q^perp(A). */
export const TRAPDOOR_BASIS: Mat = [
  [-17, -31, 12, 22],
  [11, 2, 59, -8],
  [-42, 48, 9, 38],
  [69, -16, -31, 53],
];

export const PROFILE_ID = 'GPV-IBE-BOUND-2x4-v1';
