import { expect, test } from 'vitest';

import { makeRng } from './battle';
import {
  combatStats,
  effectiveSpend,
  evenSpend,
  gearPrice,
  gearSetPrice,
  gearShare,
  gearStats,
  GEAR_FLOOR,
  GEAR_PRICE_K,
  GEAR_SLOTS,
  itemStat,
  MAX_LEVEL,
  powerScale,
  QUALITY_MAX,
  QUALITY_MIN,
  RARITIES,
  REGION_DAILY_GOLD,
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
  // Lv1에도 장비가 맨몸의 절반을 얹는다 (GEAR_FLOOR).
  // 0이면 티어 1 무기가 ATK +1이 되어 힘 1포인트(+2)보다 약해진다
  expect(gearShare(1)).toBe(GEAR_FLOOR);
  expect(powerScale(1)).toBe(1);

  // Lv1 33% → Lv50 86%. 뒤로 갈수록 장비 비중이 커지는 건 그대로다
  for (const [level, want] of [
    [1, 0.33],
    [10, 0.48],
    [50, 0.86],
  ] as const) {
    expect(gearShare(level) / (1 + gearShare(level)), `Lv${level} 장비 몫`).toBeCloseTo(want, 2);
  }

  for (const level of [10, 25, 50]) {
    const naked = combatStats(level);
    const set = GEAR_SLOTS.map((slot) => ({ ...gearStats(level, slot, 'common'), luk: 0 }));
    const sum = set.reduce((a, g) => ({
      atk: a.atk + g.atk,
      maxHp: a.maxHp + g.maxHp,
      def: a.def + g.def,
      spd: a.spd + g.spd,
      luk: 0,
    }));
    // 장비 몫은 1차 스탯만큼 %로 커진다 (T17_7 검수) — **균등 배분한 사람이 꼈을 때** 몫이 된다
    const even = evenSpend(level);
    const worn = combatStats(level, 'warrior', even, sum);
    const bare = combatStats(level, 'warrior', even);
    // 부위 몫(SLOT_BIAS)의 합이 1.0이므로 풀세트 = 그 레벨의 장비 몫 전체가 된다
    expect((naked.atk + worn.atk - bare.atk) / naked.atk).toBeCloseTo(1 + gearShare(level), 1);
    expect((naked.maxHp + worn.maxHp - bare.maxHp) / naked.maxHp).toBeCloseTo(
      1 + gearShare(level),
      1,
    );
  }
});

test('균등 배분이 제일 세다 — 평균 넘는 몫은 절반, 장비 몫은 1차 스탯만큼 커진다 (T17_7 검수)', () => {
  // 평균을 넘는 몫만 깎는다. 넷이 같으면 그대로다
  expect(effectiveSpend({ str: 10, vit: 10, agi: 10, luk: 10, int: 0 })).toEqual({
    str: 10,
    vit: 10,
    agi: 10,
    luk: 10,
    int: 0,
  });
  // 40점을 힘에만 → 평균 10을 넘는 30은 절반 = 25점
  expect(effectiveSpend({ str: 40, vit: 0, agi: 0, luk: 0, int: 0 }).str).toBe(25);

  // 같은 장비라도 힘이 높으면 장비 ATK가 더 커진다 — 1점당 장비 몫 +0.8%
  const gear = { atk: 1000, maxHp: 0, def: 0, spd: 0, luk: 0 };
  const lo = combatStats(20, 'warrior', { str: 0, vit: 0, agi: 0, luk: 0, int: 0 }, gear);
  const hi = combatStats(20, 'warrior', { str: 10, vit: 0, agi: 0, luk: 0, int: 0 }, gear);
  expect(hi.atk - lo.atk).toBeCloseTo(10 * 2 + 1000 * 0.008 * 10);
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

test('장비 값은 성능에 비례한다 — 골드당 얻는 게 티어마다 같다 (§4.5)', () => {
  // 값이 티어가 아니라 **그 장비가 주는 몫**을 따른다. T13에서는 티어 1 풀세트가
  // 1,616골드인데 ATK +1밖에 안 줘서 첫 구매가 함정이었다.
  let last = 0;
  for (const level of [3, 6, 10, 14, 18, 23, 29, 34, 40, 47]) {
    const pieces = GEAR_SLOTS.reduce((sum, slot) => sum + gearPrice(level, slot, 'common'), 0);
    // SLOT_PRICE 합이 6이라 부위 값을 다 더하면 세트 값이 된다
    expect(Math.abs(pieces - gearSetPrice(level)) / gearSetPrice(level)).toBeLessThan(0.02);
    // 골드당 성능이 일정하다 = 값 ÷ 장비 몫이 어느 레벨에서나 같다
    // 부위마다 정수로 반올림하므로 딱 떨어지진 않는다. 1% 안이면 비례다
    expect(Math.abs(pieces / gearShare(level) - GEAR_PRICE_K) / GEAR_PRICE_K).toBeLessThan(0.01);
    expect(pieces).toBeGreaterThan(last);
    last = pieces;
  }

  // 마지막 티어 풀세트는 지역 5 하루 수입의 1.2일치 (§6.3)
  const top = GEAR_SLOTS.reduce((sum, slot) => sum + gearPrice(MAX_LEVEL, slot, 'common'), 0);
  expect(top / REGION_DAILY_GOLD[REGION_DAILY_GOLD.length - 1]).toBeCloseTo(1.2, 1);
});
