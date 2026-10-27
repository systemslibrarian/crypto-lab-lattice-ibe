import { describe, expect, it } from 'vitest';
import {
  add,
  centeredMod,
  columns,
  determinantBareiss,
  distanceModulo,
  dot,
  extendedGcd,
  gramSchmidtRows,
  inverseMod,
  invertTwoByTwo,
  isPrime,
  matVec,
  mod,
  multiplyMatrices,
  norm,
  scale,
  subtract,
  transpose,
} from './math.ts';

describe('exact small-matrix helpers', () => {
  it('normalizes modular representatives and centered representatives', () => {
    expect(mod(-1, 7)).toBe(6);
    expect(mod(15, 7)).toBe(1);
    expect(centeredMod(6, 7)).toBe(-1);
    expect(centeredMod(3, 7)).toBe(3);
  });

  it('rejects malformed modular inputs', () => {
    expect(() => mod(1.2, 7)).toThrow(/MOD_INPUT/);
    expect(() => mod(1, 1)).toThrow(/MOD_INPUT/);
  });

  it('computes vector arithmetic and rejects dimension mismatches', () => {
    expect(dot([1, 2], [3, 4])).toBe(11);
    expect(add([1, 2], [3, 4])).toEqual([4, 6]);
    expect(subtract([1, 2], [3, 4])).toEqual([-2, -2]);
    expect(scale([2, -3], 4)).toEqual([8, -12]);
    expect(norm([3, 4])).toBe(5);
    expect(() => dot([1], [1, 2])).toThrow(/DOT_DIMENSION/);
    expect(() => add([1], [1, 2])).toThrow(/ADD_DIMENSION/);
    expect(() => subtract([1], [1, 2])).toThrow(/SUBTRACT_DIMENSION/);
  });

  it('multiplies, transposes, and exposes columns', () => {
    expect(matVec([[1, 2], [3, 4]], [5, 6])).toEqual([17, 39]);
    expect(columns([[1, 2], [3, 4]])).toEqual([[1, 3], [2, 4]]);
    expect(transpose([[1, 2], [3, 4]])).toEqual([[1, 3], [2, 4]]);
    expect(multiplyMatrices([[1, 2]], [[3], [4]])).toEqual([[11]]);
    expect(() => matVec([], [])).toThrow(/MATRIX_EMPTY/);
    expect(() => matVec([[]], [])).toThrow(/MATVEC_DIMENSION/);
    expect(() => matVec([[1, 2]], [1])).toThrow(/MATVEC_DIMENSION/);
    expect(() => matVec([[1], [1, 2]], [1])).toThrow(/MATVEC_DIMENSION/);
    expect(() => columns([])).toThrow(/MATRIX_EMPTY/);
    expect(() => columns([[]])).toThrow(/MATRIX_RAGGED/);
    expect(() => columns([[1], [1, 2]])).toThrow(/MATRIX_RAGGED/);
    expect(() => multiplyMatrices([], [[1]])).toThrow(/MATRIX_EMPTY/);
    expect(() => multiplyMatrices([[1]], [])).toThrow(/MATRIX_EMPTY/);
    expect(() => multiplyMatrices([[]], [[]])).toThrow(/MATRIX_MULTIPLY_DIMENSION/);
    expect(() => multiplyMatrices([[1], [1, 2]], [[1]])).toThrow(/MATRIX_MULTIPLY_DIMENSION/);
    expect(() => multiplyMatrices([[1]], [[1, 2], [3]])).toThrow(/MATRIX_MULTIPLY_DIMENSION/);
    expect(() => multiplyMatrices([[1]], [[1, 2], [3, 4]])).toThrow(/MATRIX_MULTIPLY_DIMENSION/);
  });

  it('computes Gram-Schmidt vectors and rejects dependent/non-square bases', () => {
    const result = gramSchmidtRows([[1, 1], [1, -1]]);
    expect(result.orthogonal).toEqual([[1, 1], [1, -1]]);
    expect(result.norms).toEqual([Math.sqrt(2), Math.sqrt(2)]);
    expect(() => gramSchmidtRows([])).toThrow(/BASIS_EMPTY/);
    expect(() => gramSchmidtRows([[1, 2, 3], [4, 5, 6]])).toThrow(/BASIS_DIMENSION/);
    expect(() => gramSchmidtRows([[1, 0], [2, 0]])).toThrow(/BASIS_DEPENDENT/);
  });

  it('computes determinants without floating-point division', () => {
    expect(determinantBareiss([[2, 3], [5, 7]])).toBe(-1n);
    expect(determinantBareiss([[0, 1], [2, 3]])).toBe(-2n);
    expect(determinantBareiss([[1, 2], [2, 4]])).toBe(0n);
    expect(determinantBareiss([[1, 0, 0], [0, 0, 1], [0, 0, 2]])).toBe(0n);
    expect(() => determinantBareiss([[1, 2]])).toThrow(/DETERMINANT_DIMENSION/);
    expect(() => determinantBareiss([[1.5]])).toThrow(/DETERMINANT_INTEGER/);
  });

  it('inverts two-by-two matrices modulo a prime', () => {
    const inverse = invertTwoByTwo([[2, 3], [1, 4]], 7);
    expect(multiplyMatrices([[2, 3], [1, 4]], inverse).map((row) => row.map((v) => mod(v, 7))))
      .toEqual([[1, 0], [0, 1]]);
    expect(inverseMod(3, 7)).toBe(5);
    expect(() => inverseMod(0, 7)).toThrow(/MOD_INVERSE/);
    expect(() => invertTwoByTwo([[1]], 7)).toThrow(/INVERSE_2X2_DIMENSION/);
  });

  it('retains Bezout coefficients and modular distances', () => {
    const result = extendedGcd(-30, 18);
    expect(result.gcd).toBe(6);
    expect(-30 * result.x + 18 * result.y).toBe(6);
    expect(distanceModulo(6, 0, 7)).toBe(1);
    expect(extendedGcd(30, 18).x).toBeGreaterThanOrEqual(-18);
    expect(() => extendedGcd(1.5, 2)).toThrow(/GCD_INTEGER/);
    expect(() => extendedGcd(1, 2.5)).toThrow(/GCD_INTEGER/);
  });

  it('recognizes primes and composites', () => {
    expect(isPrime(4093)).toBe(true);
    expect(isPrime(4095)).toBe(false);
    expect(isPrime(2)).toBe(true);
    expect(isPrime(1)).toBe(false);
    expect(isPrime(9)).toBe(false);
    expect(isPrime(2.5)).toBe(false);
  });
});
