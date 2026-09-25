import { expect, test } from 'vitest';

import {
  bossOf,
  equipmentById,
  fieldById,
  fieldDropTier,
  MONSTERS,
  monstersOfField,
  regionById,
} from '../content';
import { defaultSave, SaveSchema, type Save } from '../save/schema';
import { currentMonster, enterField, settleRun } from './field';
import {
  BAG,
  DEX,
  DROP_RARITY,
  INDIVIDUAL_REWARD_RATE,
  MATERIAL_BUFF,
  REGION_COUNT,
  withLegendary,
  WP_COST,
} from './formulas';
import { makeItem } from './items';
import { statsOf } from './progression';
import { bossCost, bossState, enterBoss, travel, unlockCost, unlockNext } from './region';

/** WP·골드가 넉넉한 세이브. */
function ready(over: Partial<Save> = {}): Save {
  const base = defaultSave();
  return {
    ...base,
    wp: { ...base.wp, current: 1_000_000 },
    player: { ...base.player, gold: 100_000 },
    ...over,
  };
}

/** 드랍 판정·등급·품질을 전부 맨 앞으로 — 확실히 떨어지고 common이 나온다. */
const always = () => 0;

test('보스 — 처음엔 첫 도전 값, 한 번 들어가면 재도전 값이다 (§4.1, T17_5)', () => {
  const save = ready();
  expect(bossCost(save, 1)).toBe(WP_COST.bossFirst(1));

  const inside = enterBoss(save)!;
  expect(save.wp.current - inside.wp.current).toBe(WP_COST.bossFirst(1));
  expect(inside.run).toMatchObject({ boss: true, size: 1, monsterId: bossOf(1).id });
  expect(currentMonster(inside)!.id).toBe(bossOf(1).id);
  // 들어가는 순간 적어 둔다 — 나가도 비용은 안 돌아온다
  expect(bossState(inside, 1)).toBe('tried');
  // 보스전 중에 앱이 꺼져도 세이브를 다시 읽을 수 있어야 한다 (size 1 — T17_6 검수에서 고침)
  expect(() => SaveSchema.parse(inside)).not.toThrow();

  const fled = settleRun(inside, 'flee', inside.player.hp, always, 0);
  expect(fled.over).toBe(true);
  expect(fled.save.run).toBeNull();
  expect(bossCost(fled.save, 1)).toBe(WP_COST.bossRetry(1));
});

test('보스를 잡으면 보상을 통째로 받고, 다음 지역 앞단 티어 장비를 확정으로 받는다 (T17_5)', () => {
  const inside = enterBoss(ready())!;
  const boss = bossOf(1);
  const won = settleRun(inside, 'win', inside.player.hp, always, 0);

  expect(won.bossCleared).toBe(true);
  expect(bossState(won.save, 1)).toBe('cleared');
  // 1:1이라 클리어 보너스가 없는 대신 ×0.54 없이 통째로 (골드는 LUK 배율이 붙는다)
  expect(won.gained.exp).toBe(boss.exp);
  expect(won.gained.gold).toBeGreaterThanOrEqual(boss.gold);

  const drop = equipmentById(won.drop!.defId);
  expect(drop.tier).toBe(3); // 지역 1을 넘으면 지역 2 앞단
  expect(['rare', 'epic', 'legendary']).toContain(drop.rarity);
  expect(won.save.inventory).toContainEqual(won.drop);
});

test('잡은 보스는 재사냥 — 재도전 값, EXP · 골드와 도감 한 단계만, 장비 · 해금 없음 (T19 검수)', () => {
  const first = settleRun(enterBoss(ready())!, 'win', 100, always, 0).save;
  const again = enterBoss(first)!;
  expect(first.wp.current - again.wp.current).toBe(WP_COST.bossRetry(1));
  expect(bossState(again, 1)).toBe('cleared');

  const won = settleRun(again, 'win', 100, always, 0);
  expect(won.gained.exp).toBe(bossOf(1).exp);
  expect(won.drop).toBeNull();
  expect(won.bossCleared).toBe(false);
  expect(won.save.inventory).toEqual(first.inventory);
  expect(won.dex?.stage).toBe(2);
  // 져도 잡은 기록은 그대로
  const lost = settleRun(enterBoss(won.save)!, 'lose', 0, always, 0).save;
  expect(bossState(lost, 1)).toBe('cleared');

  // 추억과 도감용 — WP당 EXP가 다음 지역 평균 판(4마리, 보너스 없이)보다 적어야 한다
  for (let r = 1; r < REGION_COUNT; r++) {
    const next = MONSTERS.filter((m) => m.region === r + 1 && !m.boss);
    const run = (next.reduce((a, m) => a + m.exp, 0) / next.length) * INDIVIDUAL_REWARD_RATE * 4;
    expect(bossOf(r).exp / WP_COST.bossRetry(r)).toBeLessThan(run / WP_COST.fieldEntry(r + 1));
  }
});

test('보스 — 판 안이거나 가방이 차 있으면 못 들어간다', () => {
  const save = ready();
  expect(enterBoss(enterField(save, 'f_r1_meadow', always)!)).toBeNull();

  // 이기면 확정으로 주는데 받을 칸이 없으면 관문 값을 치른 보상이 날아간다
  let full = save;
  for (let i = 0; i < BAG.capacity; i++) {
    full = {
      ...full,
      inventory: [...full.inventory, makeItem(full.inventory, 'eq_t1_helm_common', always)],
    };
  }
  expect(enterBoss(full)).toBeNull();
  expect(enterBoss({ ...save, wp: { ...save.wp, current: 0 } })).toBeNull();
});

test('보스 버프 — 그 지역 소재 하나에 무작위 전투력 하나 ×1.1, 그 판에만 (T17_6 검수, 시뮬은 들어가며 붙인다)', () => {
  const [a, b] = regionById(1).fields.map((f) => f.id);
  const save = ready({ materials: { [a]: 2, [b]: 1 } });

  // 난수 0이면 매번 첫 번째(ATK) — 세 번 겹치면 ×1.331
  const inside = enterBoss(save, 3, always)!;
  expect(inside.run!.buffs).toEqual(['atk', 'atk', 'atk']);
  expect(inside.materials).toEqual({});
  expect(statsOf(inside).atk).toBeCloseTo(statsOf(save).atk * MATERIAL_BUFF.mult ** 3);
  expect(statsOf(inside).def).toBeCloseTo(statsOf(save).def);

  // 끝나면 사라진다
  const fled = settleRun(inside, 'flee', inside.player.hp, always, 0).save;
  expect(statsOf(fled).atk).toBeCloseTo(statsOf(save).atk);

  // 가진 것보다 많이는 못 쓴다 · 최대 3개 · 안 쓰면 버프 없음
  expect(enterBoss(ready({ materials: { [a]: 1 } }), 2, always)).toBeNull();
  expect(enterBoss(ready({ materials: { [a]: 9 } }), 5, always)!.run!.buffs).toHaveLength(3);
  expect(enterBoss(save)!.run!.buffs).toEqual([]);
});

test('해금은 보스를 잡아야 되고, 이동은 따로 낸다 (§4.1, T17_5)', () => {
  const save = ready();
  expect(unlockNext(save)).toBeNull();
  expect(travel(save, 2)).toBeNull();

  const cleared = settleRun(enterBoss(save)!, 'win', 100, always, 0).save;
  const unlocked = unlockNext(cleared)!;
  expect(cleared.wp.current - unlocked.wp.current).toBe(WP_COST.regionUnlock(1));
  expect(unlocked.regionProgress).toMatchObject({ current: 1, unlocked: 2 });
  // 해금만 했지 옮겨주지는 않는다
  expect(unlockNext(unlocked)).toBeNull();
  expect(unlockCost(unlocked)).toBe(WP_COST.regionUnlock(2));

  const moved = travel(unlocked, 2)!;
  expect(unlocked.wp.current - moved.wp.current).toBe(WP_COST.regionTravel);
  expect(moved.regionProgress.current).toBe(2);
  // 해금 안 된 곳, 지금 있는 곳은 못 간다
  expect(travel(moved, 3)).toBeNull();
  expect(travel(moved, 2)).toBeNull();
  // 돌아가는 것도 매번 낸다
  expect(travel(moved, 1)!.wp.current).toBe(moved.wp.current - WP_COST.regionTravel);
});

test('드랍 — 부위는 몬스터가, 티어는 사냥터가 정한다. 가방이 차면 못 줍는다 (T17_6)', () => {
  const field = fieldById('f_r1_camp');
  const entered = enterField(ready(), field.id, always)!;
  const monster = currentMonster(entered)!;

  const won = settleRun(entered, 'win', entered.player.hp, always, 0);
  const drop = equipmentById(won.drop!.defId);
  expect(drop.slot).toBe(monster.drop);
  expect(drop.tier).toBe(fieldDropTier(field));
  expect(drop.rarity).toBe('common');

  // 가방이 차 있으면 떨어져도 못 줍는다 — 사냥은 이어진다
  let full = entered;
  for (let i = 0; i < BAG.capacity; i++) {
    full = {
      ...full,
      inventory: [...full.inventory, makeItem(full.inventory, 'eq_t1_helm_common', always)],
    };
  }
  const lost = settleRun(full, 'win', full.player.hp, always, 0);
  expect(lost.drop).toBeNull();
  expect(lost.dropLost).toBe(true);
  expect(lost.save.inventory).toHaveLength(full.inventory.length);
});

test('드랍 확률은 기본 3%에 LUK 배율을 곱한다 (T17_6)', () => {
  const field = 'f_r1_meadow';
  // 3.5%는 행운 4점(×1.08 → 3.24%)으로는 안 뜨고, 행운 54점(×2.08 → 6.24%)이면 뜬다
  const at = (luk: number) => {
    const save = ready({ statPoints: { ...defaultSave().statPoints, luk } });
    const entered = enterField(save, field, always)!;
    return settleRun(entered, 'win', entered.player.hp, () => 0.035, 0).drop;
  };
  expect(at(0)).toBeNull();
  expect(at(50)).not.toBeNull();
});

test('보스 카드 2번 — 그 지역 사냥터 드랍 ×1.5, 5번 — 전설 비율 ×1.5 (T19 검수 3차)', () => {
  // 4%는 기본 행운(3.24%)으로는 안 뜨고, 지역 1 보스 2번이면(4.86%) 뜬다. 지역 2 보스는 상관없다
  const at = (boss: string, kills: number, field = 'f_r1_meadow') => {
    const entered = enterField(ready({ dex: { [boss]: kills } }), field, always)!;
    return settleRun(entered, 'win', entered.player.hp, () => 0.04, 0).drop;
  };
  expect(at(bossOf(1).id, 1)).toBeNull();
  expect(at(bossOf(1).id, 2)).not.toBeNull();
  expect(at(bossOf(2).id, 2)).toBeNull();

  // 전설만 7.5%로 — 나머지가 같은 비율로 줄어 합은 1
  const table = withLegendary(DROP_RARITY, DEX.bossLegendMult);
  expect(table.legendary).toBeCloseTo(DROP_RARITY.legendary! * DEX.bossLegendMult);
  expect(Object.values(table).reduce((a, b) => a + b!, 0)).toBeCloseTo(1);
  expect(table.common! / table.rare!).toBeCloseTo(DROP_RARITY.common! / DROP_RARITY.rare!);
});

test('사냥터마다 드랍 부위가 2~4개다 — 한 곳에서 전부 나오지 않는다 (T17_6)', () => {
  for (const id of ['f_r1_meadow', 'f_r3_ridge', 'f_r5_throne']) {
    const slots = new Set(monstersOfField(fieldById(id)).map((m) => m.drop));
    expect(slots.size).toBeGreaterThanOrEqual(2);
    expect(slots.size).toBeLessThanOrEqual(4);
  }
});
