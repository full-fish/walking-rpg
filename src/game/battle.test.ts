import { expect, test, vi } from 'vitest';

import {
  actionRatio,
  combatStats,
  damageMultiplier,
  HARDCAP_ACTIONS,
  LEVEL_GROWTH,
  SPD_RATIO_MAX,
} from './formulas';
import { makeRng, simulateBattle, type Combatant } from './battle';

/** Lv1 전사. BASE_STATS는 1차 스탯을 뺀 잔여분이라 그대로 쓰면 플레이어가 안 된다. */
const LV1 = combatStats(1);

const player = (over: Partial<Combatant> = {}): Combatant => ({
  name: '플레이어',
  ...LV1,
  hp: LV1.maxHp,
  ...over,
});

const monster = (over: Partial<Combatant> = {}): Combatant => ({
  name: '초록 슬라임',
  hp: 120,
  maxHp: 120,
  atk: 6,
  def: 4,
  spd: 9,
  cri: 0.02,
  crd: 1.5,
  eva: 0.03,
  ...over,
});

test('같은 시드면 같은 전투가 나온다', () => {
  const a = simulateBattle(player(), monster(), makeRng(42));
  const b = simulateBattle(player(), monster(), makeRng(42));
  expect(a).toEqual(b);
  // 시드가 다르면 달라야 난수가 실제로 도는 것
  expect(simulateBattle(player(), monster(), makeRng(43))).not.toEqual(a);
});

test('SPD 13 vs 10 → 행동 횟수 비율이 1.30 ± 0.02', () => {
  let playerActions = 0;
  let monsterActions = 0;
  for (let seed = 0; seed < 200; seed++) {
    // 양쪽 다 안 죽을 만큼 HP를 크게 줘서 비율만 본다
    const r = simulateBattle(
      player({ spd: 13, hp: 1e9, maxHp: 1e9 }),
      monster({ spd: 10, hp: 2_000, maxHp: 2_000 }),
      makeRng(seed),
    );
    expect(r.outcome).toBe('win');
    for (const e of r.events) {
      if (e.actor === 'player') playerActions++;
      else monsterActions++;
    }
  }
  // toBeCloseTo(x, 2)는 허용 오차가 ±0.005다. §4.2 기준은 ±0.02라 직접 잰다.
  expect(Math.abs(playerActions / monsterActions - 1.3)).toBeLessThanOrEqual(0.02);
});

test('행동 비율은 2배가 상한 — 민첩 몰빵도 그 이상은 못 간다', () => {
  expect(actionRatio(100, 10)).toBe(SPD_RATIO_MAX);
  expect(actionRatio(1, 100)).toBe(0.5);
  expect(actionRatio(13, 10)).toBeCloseTo(1.3, 10);
});

test('피해배율 — DEF가 K와 같으면 정확히 절반', () => {
  expect(damageMultiplier(0)).toBe(1);
  expect(damageMultiplier(50)).toBe(0.5);
  expect(damageMultiplier(5)).toBeCloseTo(0.909, 3);
});

test('무승부는 없다 — 항상 한쪽이 0이 되고 결과는 win 아니면 lose', () => {
  for (let seed = 0; seed < 100; seed++) {
    const r = simulateBattle(player(), monster(), makeRng(seed));
    expect(['win', 'lose']).toContain(r.outcome);
    expect(r.outcome === 'win' ? r.monsterHp : r.playerHp).toBe(0);
    // 이긴 쪽은 살아 있어야 한다
    expect(r.outcome === 'win' ? r.playerHp : r.monsterHp).toBeGreaterThan(0);
  }
});

test('회피는 대미지 0, 그 외는 최소 1을 보장한다', () => {
  // 절대 못 맞히는 몬스터 — 모든 몬스터 행동이 miss
  const r = simulateBattle(player(), monster({ eva: 0 }), makeRng(7));
  const byMonster = r.events.filter((e) => e.actor === 'monster');
  expect(byMonster.length).toBeGreaterThan(0);

  for (const e of r.events) {
    if (e.type === 'miss') expect(e.value).toBe(0);
    else expect(e.value).toBeGreaterThanOrEqual(1);
  }

  // ATK가 1이고 DEF가 터무니없이 높아도 1은 들어간다
  const chip = simulateBattle(
    player({ atk: 1, cri: 0, eva: 0 }),
    monster({ def: 100_000, hp: 3, maxHp: 3, atk: 0, eva: 0 }),
    makeRng(1),
  );
  expect(chip.outcome).toBe('win');
  expect(chip.events.every((e) => e.value === 1)).toBe(true);
});

test('이벤트는 seq가 0부터 이어지고 hpAfter가 실제 HP를 따라간다', () => {
  const r = simulateBattle(player(), monster(), makeRng(3));
  r.events.forEach((e, i) => expect(e.seq).toBe(i));

  // 맞는 쪽 HP는 줄기만 한다
  for (const actor of ['player', 'monster'] as const) {
    const hits = r.events.filter((e) => e.actor === actor).map((e) => e.hpAfter);
    expect(hits).toEqual([...hits].sort((a, b) => b - a));
  }
  expect(r.events.at(-1)?.hpAfter).toBe(0);
});

test('서로 못 죽이면 하드캡에서 flee로 끊는다 (무한루프 방지)', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const r = simulateBattle(
    player({ atk: 1, def: 100_000, hp: 1e6, maxHp: 1e6 }),
    monster({ atk: 1, def: 100_000, hp: 1e6, maxHp: 1e6 }),
    makeRng(5),
  );
  expect(r.outcome).toBe('flee');
  expect(r.events).toHaveLength(HARDCAP_ACTIONS);
  expect(warn).toHaveBeenCalledOnce();
  warn.mockRestore();
});

test('HP가 0인 채로 들어가면 바로 진다', () => {
  const r = simulateBattle(player({ hp: 0 }), monster(), makeRng(1));
  expect(r.outcome).toBe('lose');
  expect(r.events).toHaveLength(0);
});

test('레벨 스탯은 §4.3 표 그대로 — 시작 스탯 + 직업 성장 + 3포인트 균등 배분', () => {
  // §4.3 "Lv1 기본값"은 전사 기준 합계다. 시작 스탯(STR5 VIT6 AGI4 LUK4)을 포함한 값
  expect(combatStats(1)).toMatchObject({ maxHp: 100, atk: 10, def: 5, spd: 10 });
  expect(combatStats(1).cri).toBeCloseTo(0.05, 6);
  expect(combatStats(1).eva).toBeCloseTo(0.03, 6);

  // 전사 Lv2: (maxHP +14+10, ATK +2+2, DEF +1.5+0.5, SPD +0.8+1.5) × 레벨 배수 1.04
  expect(combatStats(2).maxHp).toBe(Math.round(124 * LEVEL_GROWTH));
  expect(combatStats(2).atk).toBeCloseTo(14 * LEVEL_GROWTH, 6);
  expect(combatStats(2).spd).toBeCloseTo(12.3 * LEVEL_GROWTH, 6);
  expect(combatStats(2).eva).toBeCloseTo(0.0315, 6);

  // 도적은 더 빠르고 덜 단단하다
  const rogue = combatStats(2, 'rogue');
  expect(rogue.spd).toBeGreaterThan(combatStats(2).spd);
  expect(rogue.maxHp).toBeLessThan(combatStats(2).maxHp);

  // Lv0/음수가 들어와도 기본값 아래로 내려가지 않는다
  expect(combatStats(0)).toEqual(combatStats(1));
});

test('SPD가 빠르면 연속으로 두 번 때린다 — 화면에서 보여야 하는 것 (T8 완료 기준)', () => {
  // 플레이어 SPD 10 vs 슬라임 7.47 → 행동 비율 1.34. 서너 라운드마다 한 번 연속이 나온다.
  // 수치는 gen-content가 뽑은 지역 1 초록 슬라임 그대로다 (T11·T12).
  const slime = monster({ hp: 86, maxHp: 86, atk: 2.5, def: 1.73, spd: 7.47, eva: 0.03 });
  let battlesWithStreak = 0;

  for (let seed = 0; seed < 50; seed++) {
    const { events } = simulateBattle(player(), slime, makeRng(seed));
    const hasStreak = events.some(
      (e, i) => i > 0 && e.actor === 'player' && events[i - 1].actor === 'player',
    );
    if (hasStreak) battlesWithStreak++;
  }
  expect(battlesWithStreak).toBe(50);

  // 비율이 1에 가까우면 전투 길이 안에서는 연속이 안 나온다 — 데모 몬스터가 이랬다.
  const twin = monster({ hp: 86, maxHp: 86, atk: 2.5, def: 1.73, spd: 9.96 });
  const { events } = simulateBattle(player(), twin, makeRng(0));
  expect(
    events.some((e, i) => i > 0 && e.actor === 'player' && events[i - 1].actor === 'player'),
  ).toBe(false);
});
