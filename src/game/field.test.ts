import { expect, test } from 'vitest';

import { equipmentById, fieldById, monstersOfField } from '../content';
import { defaultSave, type Save } from '../save/schema';
import { makeRng, simulateBattle, type Combatant } from './battle';
import {
  carriedPotions,
  currentMonster,
  enterField,
  inTown,
  packPotions,
  settleRun,
  drinkPotion,
} from './field';
import { CLEAR_BONUS_RATE, POTION_CARRY_MAX, UNIQUE_TRAIT_BONUS, WP_COST } from './formulas';
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

  const hurt = { ...entered, player: { ...entered.player, hp: 10 } };
  const healed = drinkPotion(hurt, 'pot_small')!;
  expect(healed.player.hp).toBe(statsOf(hurt).maxHp);
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

test('행운을 찍으면 6마리가 아니어도 소재가 가끔 나온다 (§4.3 dropRate)', () => {
  // 행운 몰빵 Lv50 — dropRate가 최대치에 가깝다
  const lucky: Save = {
    ...ready(),
    player: { ...ready().player, level: 50 },
    statPoints: { unspent: 0, str: 0, vit: 0, agi: 0, luk: 147, int: 0 },
  };
  expect(statsOf(lucky).dropRate).toBeGreaterThan(0.25);

  let got = 0;
  let runs = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const rng = makeRng(seed);
    let save = enterField(lucky, FIELD, rng)!;
    if (save.run!.size >= 6) continue; // 6마리는 확정이라 세지 않는다
    runs += 1;
    let result = settleRun(save, 'win', 1e6, rng, 0);
    while (!result.over) result = settleRun(result.save, 'win', 1e6, rng, 0);
    if (result.material) got += 1;
  }

  // 확률이 25~30%대라 200판이면 한 자릿수로 안 떨어진다
  expect(runs).toBeGreaterThan(100);
  expect(got / runs, '소재 드랍률').toBeGreaterThan(0.15);
  expect(got / runs, '확정은 아니다').toBeLessThan(0.5);
});

test('고유 장비는 그 사냥터 몬스터에게만 특효다 (§4.5)', () => {
  const unique = equipmentById('uniq_r1_meadow');
  expect(unique.vs, '그 사냥터 풀의 traits를 들고 있다').toBeDefined();

  // 같은 무기라도 태그가 안 맞으면 보너스가 없다
  const traits = monstersOfField(fieldById(FIELD)).flatMap((m) => m.traits);
  expect(unique.vs!.some((t) => traits.includes(t))).toBe(true);

  const base: Combatant = { name: '', hp: 1e9, maxHp: 1e9, atk: 100, def: 0, spd: 10, cri: 0, crd: 1.5, eva: 0 };
  const target: Combatant = { ...base, hp: 1e6, maxHp: 1e6, atk: 0, traits: [unique.vs![0]] };
  const plain = totalDamage(base, target);
  const armed = totalDamage({ ...base, bonusVs: { [unique.vs![0]]: UNIQUE_TRAIT_BONUS } }, target);

  expect(armed / plain).toBeCloseTo(1 + UNIQUE_TRAIT_BONUS, 1);
  // 태그가 다르면 그대로다
  const other = totalDamage({ ...base, bonusVs: { 없는태그: UNIQUE_TRAIT_BONUS } }, target);
  expect(other / plain).toBeCloseTo(1, 1);
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
