import { expect, test } from 'vitest';

import { consumableById, fieldById, monstersOfField, regionById } from '../content';
import { defaultSave, type Ring, type Save } from '../save/schema';
import { makeRng, simulateBattle, type Combatant } from './battle';
import {
  addBuffs,
  carriedPotions,
  currentMonster,
  enterField,
  fieldEntryCost,
  inTown,
  packPotions,
  settleRun,
  drinkPotion,
} from './field';
import {
  CLEAR_BONUS_RATE,
  MATERIAL_BUFF,
  materialChance,
  POTION_CARRY_MAX,
  WP_COST,
} from './formulas';
import { statsOf } from './progression';

const FIELD = 'f_r1_meadow';

/** WP와 골드가 넉넉한 세이브. 판을 여러 번 돌려보려고. */
function ready(over: Partial<Save> = {}): Save {
  const base = defaultSave();
  return {
    ...base,
    wp: { ...base.wp, current: 1_000_000 },
    player: { ...base.player, gold: 100_000 },
    ...over,
  };
}

/** 이길 수밖에 없는 난수 — 회피도 크리도 안 뜨는 중간값. */
const mid = () => 0.5;

test('입장 — WP를 내고 마릿수를 뽑는다. HP 요구치는 없다 (§4.4)', () => {
  const save = ready();
  expect(inTown(save)).toBe(true);

  const entered = enterField(save, FIELD, makeRng(1))!;
  expect(inTown(entered)).toBe(false);
  expect(save.wp.current - entered.wp.current).toBe(WP_COST.fieldEntry(1));
  expect(entered.run!.size).toBeGreaterThanOrEqual(2);
  expect(entered.run!.size).toBeLessThanOrEqual(6);
  expect(entered.run!.killed).toBe(0);

  // 이미 판 안이면 또 못 들어간다
  expect(enterField(entered, FIELD, makeRng(1))).toBeNull();
  // 다 죽어가도 들어갈 수 있다 — 그 판단이 이 게임이다
  const hurt = { ...save, player: { ...save.player, hp: 1 } };
  expect(enterField(hurt, FIELD, makeRng(1))).not.toBeNull();
  // WP가 모자라면 못 들어간다
  expect(enterField({ ...save, wp: { ...save.wp, current: 0 } }, FIELD, makeRng(1))).toBeNull();
});

test('물약은 좋은 것부터 최대 3개만 들고 간다 (§4.4)', () => {
  const save = ready({ consumables: { pot_small: 5, pot_mid: 1, elixir: 2 } });
  const packed = packPotions(save);

  // Lv1 만피가 100이라 엘릭서(50%)보다 물약(중, 180)이 더 크다
  expect(Object.values(packed).reduce((s, n) => s + n, 0)).toBe(POTION_CARRY_MAX);
  expect(packed.pot_mid).toBe(1);

  const entered = enterField(save, FIELD, makeRng(1))!;
  expect(carriedPotions(entered.run!)).toBe(POTION_CARRY_MAX);
  // 들고 간 만큼은 소지품에서 빠진다 — 두 군데 다 있으면 무한 물약이 된다
  const left = Object.values(entered.consumables).reduce((s, n) => s + n, 0);
  expect(left).toBe(8 - POTION_CARRY_MAX);
});

test('사냥터 안에서만 물약을 쓴다. 만피면 안 쓴다', () => {
  const save = ready({ consumables: { pot_small: 3 } });
  expect(drinkPotion(save, 'pot_small'), '마을에서는 못 쓴다').toBeNull();

  const entered = enterField(save, FIELD, makeRng(1))!;
  expect(drinkPotion(entered, 'pot_small'), '만피').toBeNull();

  const hurt = { ...entered, player: { ...entered.player, hp: 50 } };
  const healed = drinkPotion(hurt, 'pot_small')!;
  expect(healed.player.hp).toBe(statsOf(hurt).maxHp);
  expect(carriedPotions(healed.run!)).toBe(POTION_CARRY_MAX - 1);
});

test('전투 중 물약은 세이브가 아니라 지금 보이는 HP부터 회복한다 (§4.2)', () => {
  const entered = enterField(ready({ consumables: { pot_small: 3 } }), FIELD, makeRng(1))!;
  const maxHp = statsOf(entered).maxHp;
  const def = consumableById('pot_small');
  const heal = def.heal + Math.round(maxHp * def.healRatio);

  // 전투가 재생되는 동안 세이브의 HP는 전투 시작 시점에 멈춰 있다 — 여기서는 만피다
  expect(entered.player.hp).toBe(maxHp);
  expect(drinkPotion(entered, 'pot_small'), 'atHp가 없으면 만피라 거절한다').toBeNull();

  const healed = drinkPotion(entered, 'pot_small', 1)!;
  expect(healed.player.hp, '만피가 아니라 1에서 회복한다').toBe(Math.min(maxHp, 1 + heal));
  expect(carriedPotions(healed.run!)).toBe(POTION_CARRY_MAX - 1);
});

test('★ 개별 보상은 도망해도 남고, 클리어 보너스만 판돈이다 (§4.4)', () => {
  let save = enterField(ready(), FIELD, makeRng(3))!;
  const size = save.run!.size;

  // 한 마리만 잡고 도망친다
  const first = settleRun(save, 'win', 50, mid, 0);
  expect(first.over).toBe(size === 1);
  const afterKill = first.save;
  expect(afterKill.player.gold, '개별 보상은 즉시 들어온다').toBeGreaterThan(0);

  const fled = settleRun(afterKill, 'flee', 40, mid, 0);
  expect(fled.over, '도망하면 판이 끝난다').toBe(true);
  expect(fled.bonus, '보너스는 못 받는다').toEqual({ exp: 0, gold: 0 });
  expect(fled.save.run, '마을로 돌아간다').toBeNull();
  expect(fled.save.player.gold, '이미 받은 개별 보상은 그대로').toBe(afterKill.player.gold);

  // 안 쓴 물약은 돌려준다
  save = enterField(ready({ consumables: { pot_small: 3 } }), FIELD, makeRng(3))!;
  const out = settleRun(save, 'flee', 40, mid, 0);
  expect(out.save.consumables.pot_small).toBe(3);
});

test('★ 완주하면 클리어 보너스 = 개별 합 × 0.2 × 마릿수 (§4.4)', () => {
  let save = enterField(ready(), FIELD, makeRng(7))!;
  const size = save.run!.size;
  let individual = 0;
  let result = settleRun(save, 'win', 100, mid, 0);

  for (let i = 1; i < size; i++) {
    individual += result.gained.gold;
    expect(result.over, `${i}번째는 안 끝난다`).toBe(false);
    save = result.save;
    result = settleRun(save, 'win', 100, mid, 0);
  }

  expect(result.over).toBe(true);
  expect(result.cleared).toBe(true);
  // 마지막 판정의 gained에는 개별 + 보너스가 같이 들어 있다
  const lastIndividual = result.gained.gold - result.bonus.gold;
  expect(result.bonus.gold).toBe(
    Math.round((individual + lastIndividual) * CLEAR_BONUS_RATE * size),
  );
  expect(result.save.run).toBeNull();
});

test('6마리를 완주하면 소재가 확정으로 떨어진다 (§4.4)', () => {
  // 마릿수 6이 나오는 시드를 찾는다
  let save: Save | null = null;
  for (let seed = 1; seed < 500 && !save; seed++) {
    const tried = enterField(ready(), FIELD, makeRng(seed))!;
    if (tried.run!.size === 6) save = tried;
  }
  expect(save, '6마리 판을 못 찾았다').not.toBeNull();

  let result = settleRun(save!, 'win', 100, mid, 0);
  while (!result.over) result = settleRun(result.save, 'win', 100, mid, 0);

  expect(result.material).toBe(FIELD);
  expect(result.save.materials[FIELD]).toBe(1);
});

test('죽으면 개별 보상은 남고 소지 골드 10%를 잃는다 (§4.2, §4.4)', () => {
  const save = enterField(ready(), FIELD, makeRng(3))!;
  const won = settleRun(save, 'win', 50, mid, 0).save;
  const before = won.player.gold;

  const dead = settleRun(won, 'lose', 0, mid, 0);
  expect(dead.over).toBe(true);
  expect(dead.goldLost).toBe(Math.floor(before * 0.1));
  expect(dead.save.run).toBeNull();
  expect(dead.save.player.hp).toBeGreaterThan(0);
});

test('상대 몬스터는 그 사냥터 풀에서만 나온다', () => {
  const pool = monstersOfField(fieldById(FIELD)).map((m) => m.id);
  for (let seed = 1; seed < 30; seed++) {
    const save = enterField(ready(), FIELD, makeRng(seed))!;
    expect(pool).toContain(currentMonster(save)!.id);
  }
});

test('소재 — 6마리 확정 · 5마리 50% · 4마리 20%에 드랍 배율, 3마리 이하 0 (§4.4, T17_7 검수 4차)', () => {
  expect(materialChance(6, 1)).toBe(1);
  expect(materialChance(5, 1)).toBe(0.5);
  expect(materialChance(4, 1.5)).toBeCloseTo(0.3);
  expect(materialChance(5, 4), '1을 넘지 않는다').toBe(1);
  expect(materialChance(3, 10), '3마리 이하는 행운이 아무리 높아도 0').toBe(0);

  // 실제 판에서도 — 행운 몰빵(드랍 ×2.51)이면 5마리도 확정, 4마리는 50%, 3마리 이하는 0
  const lucky: Save = {
    ...ready(),
    player: { ...ready().player, level: 50 },
    statPoints: { unspent: 0, str: 0, vit: 0, agi: 0, luk: 147 },
  };
  expect(statsOf(lucky).dropMult).toBeCloseTo(2.51);
  const runs = new Map<number, { n: number; got: number }>();
  for (let seed = 1; seed <= 300; seed++) {
    const rng = makeRng(seed);
    const save = enterField(lucky, FIELD, rng)!;
    const size = save.run!.size;
    let result = settleRun(save, 'win', 1e6, rng, 0);
    while (!result.over) result = settleRun(result.save, 'win', 1e6, rng, 0);
    const row = runs.get(size) ?? { n: 0, got: 0 };
    runs.set(size, { n: row.n + 1, got: row.got + (result.material ? 1 : 0) });
  }
  expect(runs.get(2)!.got + runs.get(3)!.got).toBe(0);
  expect(runs.get(5)!.got).toBe(runs.get(5)!.n);
  expect(runs.get(6)!.got).toBe(runs.get(6)!.n);
  const four = runs.get(4)!;
  expect(four.got / four.n).toBeGreaterThan(0.35);
  expect(four.got / four.n).toBeLessThan(0.65);
});

test('반지 — 입장 WP 할인(상한 50%) · 6마리 판 · 클리어 보너스 · EXP (T17_7)', () => {
  const ring = (kind: Ring['kind'], uid: string, over: Partial<Ring> = {}): Ring => ({
    uid,
    kind,
    tier: 1,
    rarity: 'common',
    enhance: 0,
    ...over,
  });
  const wearing = (...rings: Ring[]): Save =>
    ready({ rings, ringSlots: [rings[0]?.uid ?? null, rings[1]?.uid ?? null] });

  // 입장 WP −4%. 끝까지 올린 두 개(각 −51%)를 껴도 절반까지만 깎인다
  expect(fieldEntryCost(wearing(ring('fieldWp', '1')), 1)).toBe(
    Math.round(WP_COST.fieldEntry(1) * 0.96),
  );
  const max = { tier: 5, rarity: 'legendary' as const, enhance: 10 };
  expect(fieldEntryCost(wearing(ring('fieldWp', '1', max), ring('fieldWp', '2', max)), 1)).toBe(
    Math.round(WP_COST.fieldEntry(1) * 0.5),
  );

  // 6마리 판이 늘어난다 — ★5 전설 +10 두 개면 10% → 약 35%
  const sixRate = (save: Save) => {
    let six = 0;
    for (let seed = 1; seed <= 2_000; seed++)
      if (enterField(save, FIELD, makeRng(seed))!.run!.size === 6) six++;
    return six / 2_000;
  };
  expect(sixRate(ready())).toBeCloseTo(0.1, 1);
  expect(sixRate(wearing(ring('bigRun', '1', max), ring('bigRun', '2', max)))).toBeGreaterThan(0.3);

  // 클리어 보너스·EXP — 같은 판을 반지 있이/없이 깨서 비교한다
  const clear = (save: Save) => {
    let result = settleRun(enterField(save, FIELD, makeRng(4))!, 'win', 1e6, mid, 0);
    while (!result.over) result = settleRun(result.save, 'win', 1e6, mid, 0);
    return result;
  };
  const base = clear(ready());
  const bonus = clear(wearing(ring('clearBonus', '1')));
  expect(bonus.bonus.gold).toBe(Math.round(base.bonus.gold * 1.05));
  const exp = clear(wearing(ring('exp', '1', { rarity: 'legendary' })));
  expect(exp.gained.exp).toBeGreaterThan(base.gained.exp * 1.02);
});

test('반지 — 보호막은 HP보다 먼저 깎이고, 보스 피해는 보스에게만 (T17_7)', () => {
  const base: Combatant = {
    name: '',
    hp: 100,
    maxHp: 100,
    atk: 10,
    def: 0,
    spd: 10,
    cri: 0,
    crd: 1.5,
    eva: 0,
  };
  const foe: Combatant = { ...base, hp: 1e6, maxHp: 1e6 };
  // 같은 난수면 같은 전투 — 보호막 30이면 끝 HP가 정확히 30 높다(보호막이 남지 않을 만큼 맞는 동안)
  const plain = simulateBattle(base, foe, makeRng(1));
  const shielded = simulateBattle({ ...base, shield: 30 }, foe, makeRng(1));
  expect(shielded.events.length).toBeGreaterThan(plain.events.length);
  const cut = plain.events.findIndex((e) => e.actor === 'monster' && e.hpAfter < 60);
  expect(shielded.events[cut].hpAfter).toBe(Math.min(100, plain.events[cut].hpAfter + 30));
  // 남은 보호막은 이벤트마다 붙은 상태에 있다 (T18) — 물약으로 끊고 이어 뽑을 때 여기서 받는다
  const first = shielded.events[0];
  expect(first.state.shield).toBe(Math.max(0, 30 - (first.actor === 'monster' ? first.value : 0)));

  // 보스 피해 +15%는 보스에게만
  const boss: Combatant = { ...foe, boss: true };
  const tank = { ...base, hp: 1e9, maxHp: 1e9 };
  const hitter = { ...tank, bossDamage: 0.15 };
  expect(totalDamage(hitter, boss) / totalDamage(tank, boss)).toBeCloseTo(1.15, 1);
  expect(totalDamage(hitter, foe) / totalDamage(tank, foe)).toBeCloseTo(1, 1);
});

/** 1,000회 때려서 총 피해를 잰다. 난수 폭(0.8~1.2)이 평균에서 지워진다. */
function totalDamage(attacker: Combatant, target: Combatant): number {
  let sum = 0;
  for (let seed = 0; seed < 1_000; seed++) {
    const r = simulateBattle(attacker, target, makeRng(seed));
    sum += r.events.filter((e) => e.actor === 'player').reduce((s, e) => s + e.value, 0);
  }
  return sum;
}

test('소재 버프 — 사냥터에서도, 몇 마리 잡고서도 쓴다. 판이 끝날 때까지 · 한 판에 3개 (T17_7 검수 5차)', () => {
  const [a, b] = regionById(1).fields.map((f) => f.id);
  const save = ready({ materials: { [a]: 3, [b]: 2 } });
  const always = () => 0; // 매번 첫 번째 = ATK

  expect(addBuffs(save, [a], always), '판 밖에서는 못 쓴다').toBeNull();

  // 한 마리 잡고 나서 — 고른 소재 그대로 빠지고 버프가 붙는다
  const entered = { ...enterField(save, FIELD, makeRng(1))!, player: { ...save.player, hp: 1e6 } };
  const one = settleRun(entered, 'win', 1e6, makeRng(1), 0).save;
  const buffed = addBuffs(one, [b, b], always)!;
  expect(buffed.run!.buffs).toEqual(['atk', 'atk']);
  expect(buffed.materials).toEqual({ [a]: 3 });
  expect(statsOf(buffed).atk).toBeCloseTo(statsOf(one).atk * MATERIAL_BUFF.mult ** 2);

  // 남은 자리는 하나 — 둘은 못 쓴다. 다른 지역 소재·없는 소재도 안 된다
  expect(addBuffs(buffed, [a, a], always)).toBeNull();
  expect(addBuffs(buffed, [b], always), '다 쓴 소재').toBeNull();
  const full = addBuffs(buffed, [a], always)!;
  expect(full.run!.buffs).toHaveLength(MATERIAL_BUFF.max);
  expect(addBuffs(full, [a], always), '한 판에 3개까지').toBeNull();

  // 판이 끝나면 버프도 끝난다
  const out = settleRun(full, 'flee', full.player.hp, always, 0).save;
  expect(out.run).toBeNull();
  expect(statsOf(out).atk).toBeCloseTo(statsOf(save).atk);
});
