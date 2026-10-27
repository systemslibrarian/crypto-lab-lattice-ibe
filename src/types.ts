export type Vec = readonly number[];
export type Mat = readonly (readonly number[])[];

export interface RandomSource {
  nextUint32(): number;
  nextFloat(): number;
  uniformInt(minInclusive: number, maxInclusive: number): number;
}
