import type { Mat, Vec } from './types.ts';

export function mod(value: number, modulus: number): number {
  if (!Number.isSafeInteger(value) || !Number.isSafeInteger(modulus) || modulus <= 1) {
    throw new Error('MOD_INPUT: safe integers and modulus > 1 required');
  }
  const reduced = value % modulus;
  return reduced < 0 ? reduced + modulus : reduced;
}

export function centeredMod(value: number, modulus: number): number {
  const reduced = mod(value, modulus);
  return reduced > Math.floor(modulus / 2) ? reduced - modulus : reduced;
}

export function dot(left: Vec, right: Vec): number {
  if (left.length !== right.length) throw new Error('DOT_DIMENSION');
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    total += left[index]! * right[index]!;
  }
  return total;
}

export function add(left: Vec, right: Vec): number[] {
  if (left.length !== right.length) throw new Error('ADD_DIMENSION');
  return left.map((value, index) => value + right[index]!);
}

export function subtract(left: Vec, right: Vec): number[] {
  if (left.length !== right.length) throw new Error('SUBTRACT_DIMENSION');
  return left.map((value, index) => value - right[index]!);
}

export function scale(vector: Vec, scalar: number): number[] {
  return vector.map((value) => value * scalar);
}

export function norm(vector: Vec): number {
  return Math.sqrt(dot(vector, vector));
}

export function matVec(matrix: Mat, vector: Vec): number[] {
  if (matrix.length === 0) throw new Error('MATRIX_EMPTY');
  const width = matrix[0]!.length;
  if (width === 0 || vector.length !== width || matrix.some((row) => row.length !== width)) {
    throw new Error('MATVEC_DIMENSION');
  }
  return matrix.map((row) => dot(row, vector));
}

export function columns(matrix: Mat): number[][] {
  if (matrix.length === 0) throw new Error('MATRIX_EMPTY');
  const width = matrix[0]!.length;
  if (width === 0 || matrix.some((row) => row.length !== width)) {
    throw new Error('MATRIX_RAGGED');
  }
  return Array.from({ length: width }, (_, column) =>
    matrix.map((row) => row[column]!),
  );
}

export interface GramSchmidtResult {
  readonly orthogonal: readonly number[][];
  readonly coefficients: readonly (readonly number[])[];
  readonly norms: readonly number[];
}

export function gramSchmidtRows(basis: Mat): GramSchmidtResult {
  if (basis.length === 0) throw new Error('BASIS_EMPTY');
  const dimension = basis[0]!.length;
  if (dimension !== basis.length || basis.some((row) => row.length !== dimension)) {
    throw new Error('BASIS_DIMENSION: full square basis required');
  }
  const orthogonal: number[][] = [];
  const coefficients = Array.from({ length: basis.length }, () =>
    Array<number>(basis.length).fill(0),
  );
  for (let rowIndex = 0; rowIndex < basis.length; rowIndex += 1) {
    const source = basis[rowIndex]!;
    let residual = [...source];
    for (let prior = 0; prior < rowIndex; prior += 1) {
      const previous = orthogonal[prior]!;
      const denominator = dot(previous, previous);
      const coefficient = dot(source, previous) / denominator;
      const coefficientRow = coefficients[rowIndex]!;
      coefficientRow[prior] = coefficient;
      residual = subtract(residual, scale(previous, coefficient));
    }
    if (norm(residual) <= Number.EPSILON) throw new Error('BASIS_DEPENDENT');
    orthogonal.push(residual);
  }
  return { orthogonal, coefficients, norms: orthogonal.map(norm) };
}

/** Fraction-free determinant. Inputs here are small exact integers. */
export function determinantBareiss(matrix: Mat): bigint {
  if (matrix.length === 0 || matrix.some((row) => row.length !== matrix.length)) {
    throw new Error('DETERMINANT_DIMENSION');
  }
  const work = matrix.map((row) =>
    row.map((value) => {
      if (!Number.isSafeInteger(value)) throw new Error('DETERMINANT_INTEGER');
      return BigInt(value);
    }),
  );
  let sign = 1n;
  let previous = 1n;
  for (let pivotIndex = 0; pivotIndex < work.length - 1; pivotIndex += 1) {
    let pivotRow = pivotIndex;
    while (pivotRow < work.length && work[pivotRow]![pivotIndex] === 0n) pivotRow += 1;
    if (pivotRow >= work.length) return 0n;
    if (pivotRow !== pivotIndex) {
      const temporary = work[pivotRow]!;
      work[pivotRow] = work[pivotIndex]!;
      work[pivotIndex] = temporary;
      sign = -sign;
    }
    const pivot = work[pivotIndex]![pivotIndex]!;
    for (let row = pivotIndex + 1; row < work.length; row += 1) {
      for (let column = pivotIndex + 1; column < work.length; column += 1) {
        const numerator =
          work[row]![column]! * pivot -
          work[row]![pivotIndex]! * work[pivotIndex]![column]!;
        work[row]![column] = numerator / previous;
      }
    }
    previous = pivot;
  }
  return sign * work[work.length - 1]![work.length - 1]!;
}

export function extendedGcd(a: number, b: number): { gcd: number; x: number; y: number } {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) throw new Error('GCD_INTEGER');
  let oldR = Math.abs(a);
  let currentR = Math.abs(b);
  let oldS = 1;
  let currentS = 0;
  let oldT = 0;
  let currentT = 1;
  while (currentR !== 0) {
    const quotient = Math.floor(oldR / currentR);
    [oldR, currentR] = [currentR, oldR - quotient * currentR];
    [oldS, currentS] = [currentS, oldS - quotient * currentS];
    [oldT, currentT] = [currentT, oldT - quotient * currentT];
  }
  return { gcd: oldR, x: a < 0 ? -oldS : oldS, y: b < 0 ? -oldT : oldT };
}

export function inverseMod(value: number, modulus: number): number {
  const { gcd, x } = extendedGcd(mod(value, modulus), modulus);
  if (gcd !== 1) throw new Error('MOD_INVERSE: value is not invertible');
  return mod(x, modulus);
}

export function invertTwoByTwo(matrix: Mat, modulus: number): number[][] {
  if (matrix.length !== 2 || matrix.some((row) => row.length !== 2)) {
    throw new Error('INVERSE_2X2_DIMENSION');
  }
  const a = matrix[0]![0]!;
  const b = matrix[0]![1]!;
  const c = matrix[1]![0]!;
  const d = matrix[1]![1]!;
  const determinantInverse = inverseMod(a * d - b * c, modulus);
  return [
    [mod(d * determinantInverse, modulus), mod(-b * determinantInverse, modulus)],
    [mod(-c * determinantInverse, modulus), mod(a * determinantInverse, modulus)],
  ];
}

export function multiplyMatrices(left: Mat, right: Mat): number[][] {
  if (left.length === 0 || right.length === 0) throw new Error('MATRIX_EMPTY');
  const shared = left[0]!.length;
  const rightWidth = right[0]!.length;
  if (
    shared !== right.length ||
    rightWidth === 0 ||
    left.some((row) => row.length !== shared) ||
    right.some((row) => row.length !== rightWidth)
  ) {
    throw new Error('MATRIX_MULTIPLY_DIMENSION');
  }
  const rightColumns = columns(right);
  return left.map((row) => rightColumns.map((column) => dot(row, column)));
}

export function transpose(matrix: Mat): number[][] {
  return columns(matrix);
}

export function distanceModulo(value: number, target: number, modulus: number): number {
  return Math.abs(centeredMod(value - target, modulus));
}

export function isPrime(value: number): boolean {
  if (!Number.isSafeInteger(value) || value < 2) return false;
  if (value % 2 === 0) return value === 2;
  for (let divisor = 3; divisor * divisor <= value; divisor += 2) {
    if (value % divisor === 0) return false;
  }
  return true;
}
