import { expect, test } from 'vitest';

import { makeRng } from './battle';
import {
  combatStats,
  gearPrice,
  gearSetPrice,
  gearShare,
  gearStats,
  GEAR_SLOTS,
  GEAR_TIERS,
  itemStat,
  powerScale,
  QUALITY_MAX,
  QUALITY_MIN,
  RARITIES,
  REGION_DAILY_GOLD,
  regionOfGearTier,
  rollQuality,
  rollRunSize,
  RUN_SIZE_WEIGHTS,
} from './formulas';

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

test('장비가 채우는 몫 — 그 레벨 common 풀세트가 기대 배수를 만든다 (§4.5)', () => {
  // Lv1은 맨몸이 기준이다. 시작부터 장비에 의존하면 첫 화면이 성립하지 않는다
  expect(gearShare(1)).toBe(0);
  expect(powerScale(1)).toBe(1);

  // Lv50에서 전투력의 85%가 장비 몫 — 이게 v5.2의 성장 모델 그 자체다
  expect(gearShare(50) / powerScale(50)).toBeCloseTo(0.854, 3);

  for (const level of [10, 25, 50]) {
    const naked = combatStats(level);
    const set = GEAR_SLOTS.map((slot) => gearStats(level, slot, 'common'));
    const atk = set.reduce((s, g) => s + g.atk, 0);
    const maxHp = set.reduce((s, g) => s + g.maxHp, 0);
    // 부위 몫(SLOT_BIAS)의 합이 1.0이므로 풀세트 = 그 레벨의 장비 몫 전체가 된다
    expect((naked.atk + atk) / naked.atk).toBeCloseTo(powerScale(level), 1);
    expect((naked.maxHp + maxHp) / naked.maxHp).toBeCloseTo(powerScale(level), 1);
  }
});

test('등급이 오르면 세진다. 품질·강화는 그 위에 곱해진다 (§4.5)', () => {
  const atks = RARITIES.map((r) => gearStats(40, 'weapon', r).atk);
  expect(atks).toEqual([...atks].sort((a, b) => a - b));
  expect(new Set(atks).size).toBe(RARITIES.length);

  // §4.5 표의 +10 배율. 80%는 표가 2.08인데 실제는 2.075라 소수 셋째 자리에서 갈린다
  for (const [quality, table] of [
    [1.0, 2.59],
    [0.8, 2.08],
    [1.2, 3.11],
  ] as const) {
    expect(Math.abs(itemStat(100, quality, 10) / 100 - table)).toBeLessThan(0.01);
  }
});

test('품질은 0.8~1.2 삼각분포 — 1.0 근처가 흔하다 (§4.5)', () => {
  const rng = makeRng(7);
  const rolls = Array.from({ length: 20_000 }, () => rollQuality(rng));

  expect(Math.min(...rolls)).toBeGreaterThanOrEqual(QUALITY_MIN);
  expect(Math.max(...rolls)).toBeLessThanOrEqual(QUALITY_MAX);
  expect(rolls.reduce((s, q) => s + q, 0) / rolls.length).toBeCloseTo(1.0, 2);

  // 가운데 0.1 폭이 바깥 0.1 폭보다 훨씬 흔해야 삼각분포다
  const mid = rolls.filter((q) => q >= 0.95 && q <= 1.05).length;
  const edge = rolls.filter((q) => q < 0.85 || q > 1.15).length;
  expect(mid).toBeGreaterThan(edge * 2);
});

test('풀세트 값 = 그 지역 하루 수입 1일치 안팎 (§4.5)', () => {
  for (let tier = 1; tier <= GEAR_TIERS; tier++) {
    const pieces = GEAR_SLOTS.reduce((sum, slot) => sum + gearPrice(tier, slot, 'common'), 0);
    // SLOT_PRICE 합이 6이라 부위 값을 다 더하면 세트 값이 된다
    expect(Math.abs(pieces - gearSetPrice(tier)) / gearSetPrice(tier)).toBeLessThan(0.02);
    const day = REGION_DAILY_GOLD[regionOfGearTier(tier) - 1];
    expect(pieces / day).toBeGreaterThan(0.5);
    expect(pieces / day).toBeLessThan(1.5);
  }
});
