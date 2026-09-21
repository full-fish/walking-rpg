import { expect, test } from 'vitest';

import { makeRng } from './battle';
import { rollRunSize, RUN_SIZE_WEIGHTS } from './formulas';

test('한 판 마릿수는 §4.4 삼각분포를 따른다 (평균 4.0)', () => {
  const rng = makeRng(1);
  const counts = new Map<number, number>();
  const RUNS = 50_000;
  for (let i = 0; i < RUNS; i++) {
    const n = rollRunSize(rng);
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }

  for (const [size, weight] of RUN_SIZE_WEIGHTS) {
    expect(Math.abs((counts.get(size) ?? 0) / RUNS - weight)).toBeLessThan(0.01);
  }

  let sum = 0;
  for (const [size, n] of counts) sum += size * n;
  expect(sum / RUNS).toBeCloseTo(4.0, 1);
});
