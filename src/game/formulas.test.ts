import { expect, test } from 'vitest';

import { makeRng } from './battle';
import {
  combatStats,
  evenSpend,
  gearPrice,
  gearSetPrice,
  gearShare,
  gearStats,
  GEAR_FLOOR,
  GEAR_PRICE_K,
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
  STARTING_STATS,
  STAT_PER_POINT,
  styleLines,
} from './formulas';

/** 그 레벨 common 한 벌의 합 (품질 100%·강화 0) — 한손검 한 벌이 기준이다 (T18) */
function commonSet(level: number) {
  return styleLines('sword')
    .map((line) => gearStats(level, line, 'common'))
    .reduce((a, g) => ({
      atk: a.atk + g.atk,
      maxHp: a.maxHp + g.maxHp,
      def: a.def + g.def,
      str: a.str + g.str,
      agi: a.agi + g.agi,
      luk: a.luk + g.luk,
      eva: a.eva + g.eva,
    }));
}

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

  // Lv1 33% → Lv50 60% (T17_7 검수 4차 — 전에는 86%). 뒤로 갈수록 장비 비중이 커지는 건 그대로다
  for (const [level, want] of [
    [1, 0.33],
    [10, 0.39],
    [50, 0.6],
  ] as const) {
    expect(gearShare(level) / (1 + gearShare(level)), `Lv${level} 장비 몫`).toBeCloseTo(want, 2);
  }

  for (const level of [10, 25, 50]) {
    const naked = combatStats(level);
    const gear = commonSet(level);
    const worn = combatStats(level, evenSpend(level), gear);
    // 부위 몫(SLOT_BIAS)의 합이 1.0이므로 풀세트 = 그 레벨의 장비 몫 전체가 된다.
    // 장갑 STR·신발 AGI가 combatStats를 지나 ATK·SPD가 된다 (T17_7 검수 5차)
    for (const key of ['atk', 'maxHp', 'spd'] as const) {
      expect(worn[key] / naked[key], `Lv${level} ${key}`).toBeCloseTo(1 + gearShare(level), 1);
    }
    // LUK도 맨몸 LUK의 같은 배수다 (T17_7 검수 5차)
    const luk = STARTING_STATS.luk + evenSpend(level).luk;
    expect(gear.luk / luk, `Lv${level} LUK`).toBeCloseTo(gearShare(level), 1);
  }
});

test('치명 배율 — Lv1 1.5배에서 힘이 올려 Lv50 균등 + common 한 벌이 3배쯤 (T17_7 검수 5차)', () => {
  const none = { str: 0, vit: 0, agi: 0, luk: 0 };
  expect(combatStats(1, none).crd).toBeCloseTo(1.5, 5);
  const lv50 = combatStats(50, evenSpend(50), commonSet(50));
  expect(lv50.crd).toBeGreaterThan(2.8);
  expect(lv50.crd).toBeLessThan(3.3);
  // 힘 1점 = ATK +2 · 배율 +0.025
  const one = combatStats(50, { ...none, str: 1 });
  const zero = combatStats(50, none);
  expect(one.atk - zero.atk).toBe(STAT_PER_POINT.str.atk);
  expect(one.crd - zero.crd).toBeCloseTo(STAT_PER_POINT.str.crd, 5);
});

test('레벨업은 포인트만 준다 — 몰빵은 제 스탯이 균등의 약 2배, 나머지는 0.6배 (T17_7 검수 4차)', () => {
  // 자동 성장이 없다 — 한 점도 안 찍은 Lv50은 Lv1 맨몸 그대로다
  const none = { str: 0, vit: 0, agi: 0, luk: 0 };
  const lv1 = combatStats(1, none);
  const lv50 = combatStats(50, none);
  expect([lv50.maxHp, lv50.atk, lv50.def, lv50.spd]).toEqual([
    lv1.maxHp,
    lv1.atk,
    lv1.def,
    lv1.spd,
  ]);
  expect([lv1.maxHp, lv1.atk, lv1.def, lv1.spd]).toEqual([100, 20, 5, 15]);

  // Lv50 common 풀세트를 끼고 — 장비는 네 스탯에 같은 배수를 얹으므로 몰빵의 이득이 대칭이다
  const gear = commonSet(50);
  const all = 49 * 3;
  const even = combatStats(50, evenSpend(50), gear);
  const agi = combatStats(50, { ...none, agi: all }, gear);
  const str = combatStats(50, { ...none, str: all }, gear);
  expect(agi.spd / even.spd).toBeCloseTo(2, 0);
  expect(str.atk / even.atk).toBeCloseTo(2, 0);
  expect(agi.atk / even.atk).toBeCloseTo(0.65, 1);
  expect(agi.maxHp / even.maxHp).toBeCloseTo(0.65, 1);
});

test('등급이 오르면 세진다. 품질·강화는 그 위에 곱해진다 (§4.5)', () => {
  const atks = RARITIES.map((r) => gearStats(40, 'longsword', r).atk);
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

test('품질은 0.80~1.20 41칸 균등 — 1.20도 1.00만큼 나온다 (§4.5, T19 검수 2차)', () => {
  const rng = makeRng(7);
  const rolls = Array.from({ length: 41_000 }, () => rollQuality(rng));

  expect(Math.min(...rolls)).toBe(QUALITY_MIN);
  expect(Math.max(...rolls)).toBe(QUALITY_MAX);
  expect(rolls.reduce((s, q) => s + q, 0) / rolls.length).toBeCloseTo(1.0, 2);

  // 칸마다 약 1,000번 — 양 끝도 가운데와 같다
  const count = (q: number) => rolls.filter((r) => r === q).length;
  for (const q of [0.8, 1.0, 1.2]) expect(count(q)).toBeGreaterThan(850);
  expect(new Set(rolls).size).toBe(41);
});

test('장비 값은 성능에 비례한다 — 골드당 얻는 게 티어마다 같다 (§4.5)', () => {
  // 값이 티어가 아니라 **그 장비가 주는 몫**을 따른다. T13에서는 티어 1 풀세트가
  // 1,616골드인데 ATK +1밖에 안 줘서 첫 구매가 함정이었다.
  let last = 0;
  for (const level of [3, 6, 10, 14, 18, 23, 29, 34, 40, 47]) {
    const pieces = styleLines('sword').reduce(
      (sum, line) => sum + gearPrice(level, line, 'common'),
      0,
    );
    // SLOT_PRICE 합이 SET_PARTS(7)라 한 벌 값을 다 더하면 세트 값이 된다
    expect(Math.abs(pieces - gearSetPrice(level)) / gearSetPrice(level)).toBeLessThan(0.02);
    // 골드당 성능이 일정하다 = 값 ÷ 장비 몫이 어느 레벨에서나 같다
    // 부위마다 정수로 반올림하므로 딱 떨어지진 않는다. 1% 안이면 비례다
    expect(Math.abs(pieces / gearShare(level) - GEAR_PRICE_K) / GEAR_PRICE_K).toBeLessThan(0.01);
    expect(pieces).toBeGreaterThan(last);
    last = pieces;
  }

  // 마지막 티어 풀세트는 지역 5 하루 수입의 1.2일치 (§6.3)
  const top = styleLines('sword').reduce(
    (sum, line) => sum + gearPrice(MAX_LEVEL, line, 'common'),
    0,
  );
  expect(top / REGION_DAILY_GOLD[REGION_DAILY_GOLD.length - 1]).toBeCloseTo(1.2, 1);
});
