import { expect, test, vi } from 'vitest';

import {
  actionRatio,
  arrowStats,
  combatStats,
  damageMultiplier,
  HARDCAP_ACTIONS,
  SPD_RATIO_MAX,
  type ArrowEffect,
} from './formulas';
import { makeRng, simulateBattle, type ArrowLoad, type Combatant } from './battle';

/** Lv1 플레이어. BASE_STATS는 1차 스탯을 뺀 잔여분이라 그대로 쓰면 플레이어가 안 된다. */
const LV1 = combatStats(1);

const player = (over: Partial<Combatant> = {}): Combatant => ({
  name: '플레이어',
  ...LV1,
  hp: LV1.maxHp,
  ...over,
});

/** 공격 `atk`짜리 화살 — 효과는 공식 그대로 (T18_1) */
const arrowOf = (atk: number, effect: ArrowEffect = 'basic'): ArrowLoad => ({
  ...arrowStats(1, 1, effect),
  effect,
  atk,
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
  // 명중(T18)에서 빗나간 건 0이다 — 맞은 건 전부 1
  expect(chip.events.filter((e) => e.type !== 'miss').every((e) => e.value === 1)).toBe(true);
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

test('레벨 스탯은 §4.3 표 그대로 — 시작 스탯 + 네 스탯 균등 배분 (자동 성장 없음)', () => {
  // §4.3 "Lv1 기본값"은 합계다. 시작 스탯(STR5 VIT6 AGI4 LUK4)을 포함한 값 (T17_7 검수 4차)
  expect(combatStats(1)).toMatchObject({ maxHp: 100, atk: 20, def: 5, spd: 15 });
  expect(combatStats(1).cri).toBeCloseTo(0.056, 6);
  expect(combatStats(1).crd).toBeCloseTo(1.5, 6);
  expect(combatStats(1).eva).toBeCloseTo(0.028, 6);

  // Lv2 = 3점을 넷에 0.75씩 — HP +7.5, ATK +1.5, DEF +0.375, SPD +1.125. 숨은 배수는 없다
  expect(combatStats(2)).toMatchObject({ maxHp: 108, atk: 21.5, def: 5.375, spd: 16.125 });
  expect(combatStats(2).eva).toBeCloseTo(0.02875, 6);

  // Lv0/음수가 들어와도 기본값 아래로 내려가지 않는다
  expect(combatStats(0)).toEqual(combatStats(1));
});

test('SPD가 빠르면 연속으로 두 번 때린다 — 화면에서 보여야 하는 것 (T8 완료 기준)', () => {
  // 플레이어 SPD 15 vs 슬라임 11.2 → 행동 비율 1.34. 서너 라운드마다 한 번 연속이 나온다.
  const slime = monster({ hp: 172, maxHp: 172, atk: 2.5, def: 1.73, spd: 11.2, eva: 0.03 });
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
  const twin = monster({ hp: 172, maxHp: 172, atk: 2.5, def: 1.73, spd: 14.94 });
  const { events } = simulateBattle(player(), twin, makeRng(0));
  expect(
    events.some((e, i) => i > 0 && e.actor === 'player' && events[i - 1].actor === 'player'),
  ).toBe(false);
});

// ─────────────────────────────────────────────────────────────
// 무기 계열 (T18) — 명중 · 특성 · 기술 · 거리 · 화살
// ─────────────────────────────────────────────────────────────

/** 늘 같은 값을 내는 난수 — 판정 하나하나를 손으로 짚으려고 쓴다 */
const always = (v: number) => () => v;
/** 안 죽는 과녁 — 싸움이 끝나지 않아 행동 순서를 끝까지 본다 */
const target = (over: Partial<Combatant> = {}) =>
  monster({ hp: 1e9, maxHp: 1e9, atk: 1, def: 0, eva: 0, cri: 0, ...over });

test('명중은 회피와 따로 굴린다 — 90%라 회피 0인 상대에게도 열에 한 번은 빗나간다 (T18)', () => {
  const blind = simulateBattle(player({ acc: 0 }), target({ hp: 30, maxHp: 30 }), makeRng(1));
  expect(blind.events.filter((e) => e.actor === 'player').every((e) => e.type === 'miss')).toBe(
    true,
  );

  let shots = 0;
  let misses = 0;
  for (let seed = 0; seed < 200; seed++) {
    const r = simulateBattle(
      player({ hp: 1e9, maxHp: 1e9 }),
      target({ hp: 400, maxHp: 400 }),
      makeRng(seed),
    );
    for (const e of r.events.filter((x) => x.actor === 'player')) {
      shots++;
      if (e.type === 'miss') misses++;
    }
  }
  expect(misses / shots).toBeGreaterThan(0.08);
  expect(misses / shots).toBeLessThan(0.12);
});

test('한손검 — 흔들림 바닥이 70%, 여섯 번째 행동마다 집중 베기(반드시 치명) (T18)', () => {
  // 난수 0 = 흔들림 바닥 · 치명 없음(cri 0)
  const plain = simulateBattle(player({ cri: 0 }), target(), always(0));
  const sword = simulateBattle(player({ cri: 0, style: 'sword' }), target(), always(0));
  const base = player().atk * damageMultiplier(0);
  expect(plain.events[0].value).toBe(Math.floor(base * 0.6));
  expect(sword.events[0].value).toBe(Math.floor(base * 0.7));

  const mine = sword.events.filter((e) => e.actor === 'player');
  expect(mine.slice(0, 12).map((e) => e.skill === true)).toEqual(
    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1].map(Boolean),
  );
  expect(mine[5].type).toBe('crit');
});

test('검과 방패 — 막으면 피해 0이고 곧바로 반격, 가드는 다음 공격 한 번을 막는다 (T18)', () => {
  const r = simulateBattle(player({ style: 'shield', block: 1 }), target({ atk: 50 }), makeRng(2));
  r.events.forEach((e, i) => {
    if (e.actor !== 'monster' || e.type === 'miss') return;
    expect(e.type).toBe('block');
    expect(r.events[i + 1]).toMatchObject({ actor: 'player', chain: true, counter: true });
  });
  expect(r.playerHp).toBe(player().maxHp);

  // 막기 0% — 여섯 번째 행동이 가드, 그다음 맞을 공격 하나가 막힌다
  const g = simulateBattle(
    player({ style: 'shield', block: 0, hp: 1e6, maxHp: 1e6 }),
    target({ atk: 50 }),
    always(0.5),
  );
  const guard = g.events.findIndex((e) => e.type === 'guard');
  expect(g.events[guard]).toMatchObject({ actor: 'player', skill: true });
  const next = g.events.slice(guard).find((e) => e.actor === 'monster' && e.type !== 'miss');
  expect(next?.type).toBe('block');
});

test('쌍칼 — 한 번에 두 번 베고, 연달아 맞히면 콤보만큼 세진다 (T18)', () => {
  // 난수 0.5 — 명중 · 흔들림 100% · 치명 없음
  const r = simulateBattle(player({ cri: 0, style: 'dual', hits: 2 }), target(), always(0.5));
  const [first, second] = r.events;
  expect(first).toMatchObject({ actor: 'player' });
  expect(second).toMatchObject({ actor: 'player', chain: true });
  const half = player().atk * 0.5 * damageMultiplier(0);
  expect(first.value).toBe(Math.floor(half));
  expect(second.value).toBe(Math.floor(half * 1.05));
  // 다섯 번 넘게 이어지면 +25%에서 멈춘다
  expect(Math.max(...r.events.map((e) => e.value))).toBe(Math.floor(half * 1.25));
});

test('대검 — 느리고, 신체파괴가 맞으면 그 전투 끝까지 적 공격이 준다 (T18)', () => {
  const hard = { hp: 1e6, maxHp: 1e6 };
  const count = (p: Combatant) =>
    simulateBattle(p, target(), makeRng(4)).events.filter((e) => e.actor === 'player').length;
  expect(count(player({ tempo: 0.8, ...hard }))).toBeLessThan(count(player(hard)));

  const r = simulateBattle(
    player({ cri: 0, style: 'great', ...hard }),
    target({ atk: 100 }),
    always(0.5),
  );
  const skill = r.events.findIndex((e) => e.skill);
  const before = r.events.slice(0, skill).find((e) => e.actor === 'monster')!.value;
  const after = r.events.slice(skill).find((e) => e.actor === 'monster')!.value;
  // 난수 0.5 = 흔들림 100% — 한 방이 늘 같고, 신체파괴 뒤로는 90%다
  const m = damageMultiplier(player().def);
  expect(before).toBe(Math.floor(100 * m));
  expect(after).toBe(Math.floor(100 * 0.9 * m));
  expect(r.events[skill].state.broken).toBe(1);
});

test('활 — 적이 다가오는 동안 나만 쏘고, 화살이 떨어지면 30%로 친다 (T18)', () => {
  // 보통 빠르기(1.2배) — 거리는 세 번 쏠 시간이라 원래 선공까지 네 번을 먼저 쏜다
  const bow = player({
    cri: 0,
    spd: 9 * 1.2,
    style: 'bow',
    arrows: 2,
    arrow: arrowOf(10),
  });
  const r = simulateBattle(bow, target({ spd: 9 }), always(0.5));
  expect(r.events.slice(0, 5).map((e) => e.actor)).toEqual([
    'player',
    'player',
    'player',
    'player',
    'monster',
  ]);
  expect(r.events[0].far).toBe(1);
  expect(r.events[3].far).toBeLessThan(r.events[1].far!);
  expect(r.events[4].far).toBeUndefined();

  // 화살 두 발은 +10으로, 그다음부터는 활로 친다(30%)
  const mult = damageMultiplier(0);
  expect(r.events[0]).toMatchObject({ arrow: 'basic', value: Math.floor((bow.atk + 10) * mult) });
  expect(r.events[1].state.arrows).toBe(0);
  expect(r.events[2].arrow).toBeUndefined();
  expect(r.events[2].value).toBe(Math.floor(bow.atk * 0.3 * mult));

  // 거리 벌리기 — 쏘고 물러나 다음 한 발도 적이 다가오는 중이다
  const skill = r.events.findIndex((e) => e.skill);
  const next = r.events.slice(skill + 1).find((e) => e.actor === 'player');
  expect(next?.far).toBeGreaterThan(0);
});

test('물약으로 끊고 이어 뽑으면 게이지 · 화살 · 첫 거리를 이어 받는다 (T18)', () => {
  const bow = player({ style: 'bow', arrows: 50, arrow: arrowOf(5) });
  const first = simulateBattle(bow, target(), makeRng(9));
  const cut = first.events[6].state;
  const rest = simulateBattle(bow, target(), makeRng(9), { ...cut, gauge: 5 });
  // 게이지가 찬 채로 이어 받으면 첫 행동이 기술이고, 첫 거리는 또 주지 않는다
  expect(rest.events[0]).toMatchObject({ actor: 'player', skill: true });
  expect(rest.events.find((e) => e.actor === 'monster')).toBeDefined();
  expect(rest.events[0].state.arrows).toBe(cut.arrows - 1);
  expect(rest.events.slice(0, 3).some((e) => e.far === 1)).toBe(false);
});
