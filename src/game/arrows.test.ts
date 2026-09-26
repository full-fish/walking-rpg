import { expect, test } from 'vitest';

import { arrowById } from '../content';
import { defaultSave, type Save } from '../save/schema';
import { makeRng, playerHpAfter, simulateBattle, type Combatant } from './battle';
import { enterField, settleRun } from './field';
import { ARROW_DROP, ARROW_EFFECT, arrowStats, combatStats, type ArrowEffect } from './formulas';
import { nameError, setName } from './progression';

const LV1 = combatStats(1);
const always = (v: number) => () => v;

/** 공격 5짜리 `effect` 화살을 넉넉히 먹인 Lv1 활 (T18_1) */
const bow = (effect: ArrowEffect, over: Partial<Combatant> = {}): Combatant => ({
  name: '활',
  ...LV1,
  hp: 1e6,
  maxHp: 1e6,
  style: 'bow',
  arrows: 10_000,
  arrow: { ...arrowStats(1, 1, effect), effect, atk: 5 },
  ...over,
});
/** 방어 · 회피 없는 과녁 — 몇백 발이면 쓰러진다 */
const target = (over: Partial<Combatant> = {}): Combatant => ({
  name: '과녁',
  hp: 2_000,
  maxHp: 2_000,
  atk: 40,
  def: 0,
  spd: 9,
  cri: 0,
  crd: 1.5,
  eva: 0,
  ...over,
});
const monsterHits = (r: ReturnType<typeof simulateBattle>) =>
  r.events.filter((e) => e.actor === 'monster' && e.type === 'hit').map((e) => e.value);

test('폭탄 화살 — 맞을 때마다 적 공격이 3%씩 줄어 −45%에서 멈춘다 (T18_1)', () => {
  const r = simulateBattle(bow('bomb'), target(), always(0.5));
  // 기본 화살이면 적의 한 방은 늘 같다 — 폭탄은 끝에 그 55%다(내림 1 안쪽)
  const full = monsterHits(simulateBattle(bow('basic'), target(), always(0.5)))[0];
  expect(Math.max(...r.events.map((e) => e.state.weak))).toBeCloseTo(ARROW_EFFECT.bomb.weakenMax!);
  expect(
    Math.abs(monsterHits(r).at(-1)! - full * (1 - ARROW_EFFECT.bomb.weakenMax!)),
  ).toBeLessThanOrEqual(1);
  expect(r.events.every((e) => e.actor === 'monster' || e.arrow === 'bomb')).toBe(true);
});

test('얼음 화살 — 맞을 때마다 적이 느려져 ×0.5에서 멈춘다. 그만큼 적이 덜 친다 (T18_1)', () => {
  const ice = simulateBattle(bow('ice'), target(), always(0.5));
  const plain = simulateBattle(bow('basic'), target(), always(0.5));
  expect(Math.min(...ice.events.map((e) => e.state.chill))).toBe(ARROW_EFFECT.ice.slowMin);
  const turns = (r: typeof ice) =>
    r.events.filter((e) => e.actor === 'monster').length /
    r.events.filter((e) => e.actor === 'player').length;
  expect(turns(ice)).toBeLessThan(turns(plain) * 0.7);
});

test('번개 화살 — 맞으면 적이 다음 차례를 쉰다. 보스는 확률이 절반이다 (T18_1)', () => {
  // 난수 0.1 — 15% 안이라 매번 기절한다. 보스는 7.5%라 안 걸린다
  const r = simulateBattle(bow('shock'), target(), always(0.1));
  const turns = r.events.filter((e) => e.actor === 'monster');
  expect(turns.length).toBeGreaterThan(0);
  expect(turns.every((e) => e.type === 'stun' && e.value === 0)).toBe(true);
  expect(r.playerHp).toBe(1e6);

  const boss = simulateBattle(bow('shock'), target({ boss: true }), always(0.1));
  expect(boss.events.some((e) => e.type === 'stun')).toBe(false);
});

test('흡혈 화살 — 맞힐 때마다 최대 HP의 몫이 모였다가 1씩 찬다. 화면은 그 HP를 따라간다 (T18_1)', () => {
  const start = 50;
  const vamp = bow('vamp', { hp: start, maxHp: 10_000 });
  // 적은 늘 빗나간다 — 흡혈만 본다
  const r = simulateBattle(vamp, target({ acc: 0 }), always(0.5));
  const landed = r.events.filter((e) => e.actor === 'player' && e.type !== 'miss').length;
  expect(r.playerHp).toBe(start + Math.floor(landed * 10_000 * ARROW_EFFECT.vamp.drain! + 1e-9));
  expect(r.events.some((e) => (e.heal ?? 0) > 0)).toBe(true);
  expect(playerHpAfter(r.events, start)).toBe(r.playerHp);
});

test('가는 · 무거운 화살은 먹인 게 남아 있는 동안만 빠르기를 바꾼다. 다 쓰면 제 빠르기 (T18_1)', () => {
  /** 적 한 번에 내가 몇 번 쏘나 — 처음 다가오는 동안의 공짜 발은 뺀다. `until`이 있으면 거기까지, `from`이면 거기부터 */
  const pace = (p: Combatant, part?: 'until' | 'from') => {
    const all = simulateBattle(p, target(), always(0.5)).events;
    const events = all.slice(all.findIndex((e) => e.actor === 'monster'));
    const cut = events.findIndex((e) => e.actor === 'player' && e.arrow === undefined);
    const seg =
      part === 'until' ? events.slice(0, cut) : part === 'from' ? events.slice(cut) : events;
    return (
      seg.filter((e) => e.actor === 'player').length /
      seg.filter((e) => e.actor === 'monster').length
    );
  };
  // 거리 벌리기(기술)도 행동 수로 돌아서, 빠르기 ×1.35인 기본 화살과 같은 박자다
  for (const effect of ['thin', 'heavy'] as const) {
    const fast = bow('basic', { spd: LV1.spd * ARROW_EFFECT[effect].tempo! });
    expect(pace(bow(effect)), effect).toBeCloseTo(pace(fast), 1);
  }
  // 80발 다 쏘면 기본 빠르기로 돌아온다
  expect(pace(bow('thin', { arrows: 80 }), 'from')).toBeCloseTo(pace(bow('basic')), 1);
  expect(pace(bow('thin', { arrows: 80 }), 'until')).toBeGreaterThan(pace(bow('basic')) * 1.2);
});

test('특수 화살은 어느 계열이든 처치마다 낮은 확률로 줍는다 — 그 지역 티어 · 30발 (T18_1)', () => {
  let got: { id: string; n: number } | null = null;
  let save: Save | null = null;
  for (let seed = 0; seed < 200 && !got; seed++) {
    let s: Save = {
      ...defaultSave(),
      player: { ...defaultSave().player, level: 10 },
      wp: { ...defaultSave().wp, current: 1e6 },
    };
    s = { ...s, statPoints: { ...s.statPoints, luk: 5000 } };
    const inside = enterField(s, 'f_r1_meadow', makeRng(seed))!;
    const won = settleRun(inside, 'win', 100, makeRng(seed), 0);
    got = won.arrowDrop;
    save = won.save;
  }
  expect(got).not.toBeNull();
  const arrow = arrowById(got!.id);
  expect(arrow).toMatchObject({ region: 1 });
  expect(arrow.effect).not.toBe('basic');
  expect(got!.n).toBe(ARROW_DROP.bundle);
  expect(save!.arrows[got!.id]).toBe(ARROW_DROP.bundle);
});

test('닉네임 — 한글 · 영문 · 숫자만 2~8자 (T18 확인)', () => {
  for (const ok of ['홍길동', 'ab12', '걷는자12', '가나다라마바사아'])
    expect(nameError(ok), ok).toBeNull();
  for (const bad of ['가', '가나다라마바사아자', '홍 길동', 'ㄱㄴㄷ', '😀😀', 'a_b', '']) {
    expect(nameError(bad), bad).not.toBeNull();
  }
  expect(setName(defaultSave(), '걷는자')!.player.name).toBe('걷는자');
  expect(setName(defaultSave(), '!')).toBeNull();
});
