import { expect, test } from 'vitest';

import { fieldById, regionById } from '../content';
import { defaultSave, type Save } from '../save/schema';
import { makeRng } from './battle';
import {
  buyConsumable,
  buyEquipment,
  depositNet,
  exchangeUnique,
  sellItem,
  sellPrice,
  stayInn,
  consumeItem,
  vaultDeposit,
  vaultExpand,
  vaultWithdraw,
} from './economy';
import { DEATH_GOLD_LOSS, innCost, VAULT, vaultExpandCost } from './formulas';
import { equipItem, settleBattle, statsOf } from './progression';

const rng = () => 0.5;

function rich(gold: number, over: Partial<Save['player']> = {}): Save {
  const base = defaultSave();
  return { ...base, player: { ...base.player, gold, ...over } };
}

test('장비 구매 — 골드가 모자라면 아무것도 안 바뀐다', () => {
  expect(buyEquipment(rich(10), 'eq_t1_weapon_common', rng)).toBeNull();

  const bought = buyEquipment(rich(10_000), 'eq_t1_weapon_common', rng)!;
  expect(bought.inventory).toHaveLength(1);
  expect(bought.player.gold).toBeLessThan(10_000);
  // 품질이 붙는다 — 같은 이름이라도 개체마다 다르다 (§4.5)
  expect(bought.inventory[0].quality).toBeGreaterThanOrEqual(0.8);
});

test('고유 장비는 골드로 못 산다 — 소재로만 바꾼다 (§4.4)', () => {
  expect(buyEquipment(rich(1_000_000), 'uniq_r1_meadow', rng)).toBeNull();
});

test('낀 장비는 못 판다 — 실수로 알몸이 되는 경로를 없앤다', () => {
  const bought = buyEquipment(rich(10_000), 'eq_t1_weapon_common', rng)!;
  const uid = bought.inventory[0].uid;

  const sold = sellItem(bought, uid)!;
  expect(sold.inventory).toHaveLength(0);
  expect(sold.player.gold - bought.player.gold).toBe(sellPrice(bought.inventory[0]));

  const worn = equipItem(bought, uid)!;
  expect(sellItem(worn, uid)).toBeNull();
});

test('물약 — 만피면 안 쓴다. 누르자마자 증발하면 억울하다 (§4.5)', () => {
  const stocked = buyConsumable(rich(1_000), 'pot_small', 2)!;
  expect(stocked.consumables.pot_small).toBe(2);
  expect(stocked.player.gold).toBe(800);

  expect(consumeItem(stocked, 'pot_small')).toBeNull(); // 만피

  // Lv1 만피가 100이라 물약(소) 한 병이면 어디서 써도 가득 찬다 — 넘치지 않는다
  const hurt = { ...stocked, player: { ...stocked.player, hp: 10 } };
  const healed = consumeItem(hurt, 'pot_small')!;
  expect(healed.player.hp).toBe(statsOf(stocked).maxHp);
  expect(healed.consumables.pot_small).toBe(1);

  // 회복량이 남아도 최대치에서 멈춘다
  const deep = { ...stocked, player: { ...stocked.player, level: 20, hp: 5 } };
  expect(consumeItem(deep, 'pot_small')!.player.hp).toBe(105);
});

test('엘릭서는 최대 HP의 50%를 채운다 (§4.5)', () => {
  const stocked = buyConsumable(rich(2_000), 'elixir')!;
  const hurt = { ...stocked, player: { ...stocked.player, hp: 1 } };
  expect(consumeItem(hurt, 'elixir')!.player.hp).toBe(1 + 50);
});

test('여관 — §4.5 표 그대로. 만피면 안 받는다', () => {
  for (const [region, want] of [
    [1, 150],
    [2, 330],
    [3, 545],
    [4, 799],
    [5, 1098],
  ] as const) {
    expect(innCost(region), `지역 ${region}`).toBe(want);
    // 계산식과 regions.json이 어긋나면 화면과 시뮬이 다른 값을 본다
    expect(regionById(region).town.inn).toBe(want);
  }

  const hurt = rich(1_000, { hp: 1 });
  const rested = stayInn(hurt, innCost(1), 0)!;
  expect(rested.player.hp).toBe(statsOf(hurt).maxHp);
  expect(rested.player.gold).toBe(850);

  expect(stayInn(rich(1_000), innCost(1), 0), '만피').toBeNull();
  expect(stayInn(rich(10, { hp: 1 }), innCost(1), 0), '돈 부족').toBeNull();
});

test('창고 — 수수료 2%, 출금 무료, 한도 초과 거부 (§3.7)', () => {
  const save = rich(10_000);
  expect(save.vault.capacity).toBe(VAULT.capacity);

  const put = vaultDeposit(save, 1_000)!;
  expect(put.vault.gold).toBe(depositNet(1_000)); // 980
  expect(put.player.gold).toBe(9_000);

  const out = vaultWithdraw(put, 980)!;
  expect(out.player.gold).toBe(9_980); // 출금은 무료 — 뗀 건 넣을 때뿐이다
  expect(out.vault.gold).toBe(0);

  expect(vaultWithdraw(put, 981), '가진 것보다 많이').toBeNull();
  expect(vaultDeposit(rich(100_000), 99_999), '한도 초과').toBeNull();
  expect(vaultDeposit(save, 0)).toBeNull();
});

test('창고 확장 — 8회가 상한이고 9회째는 거부한다 (§3.7)', () => {
  let save = rich(5_000_000);
  const costs: number[] = [];

  for (let i = 0; i < VAULT.maxExpansions; i++) {
    costs.push(vaultExpandCost(save.vault.capacity));
    save = vaultExpand(save)!;
  }

  expect(costs.slice(0, 3)).toEqual([3_000, 6_000, 12_000]);
  expect(save.vault.capacity).toBe(1_280_000);
  expect(save.vault.expansions).toBe(VAULT.maxExpansions);
  expect(vaultExpand(save), '9회째').toBeNull();
});

test('★ 사망해도 창고 골드는 면제다 (§4.5)', () => {
  const put = vaultDeposit(rich(10_000), 5_000)!;
  const before = put.vault.gold;

  const dead = settleBattle(put, 'lose', 0, { exp: 0, gold: 0 }, 0);
  expect(dead.save.vault.gold, '창고').toBe(before);
  expect(dead.goldLost, '소지 골드 10%').toBe(Math.floor(put.player.gold * DEATH_GOLD_LOSS));
});

test('고유 교환 — 소재 3개 + 골드. 소재가 모자라면 거부 (§4.4)', () => {
  const field = fieldById('f_r1_meadow');
  const save = rich(10_000);

  expect(exchangeUnique(save, 'f_r1_meadow', rng), '소재 0개').toBeNull();

  const withMats = { ...save, materials: { f_r1_meadow: 3 } };
  const got = exchangeUnique(withMats, 'f_r1_meadow', makeRng(1))!;
  expect(got.inventory[0].defId).toBe(field.reward.id);
  expect(got.materials.f_r1_meadow, '다 쓰면 항목이 사라진다').toBeUndefined();
  expect(got.player.gold).toBe(10_000 - field.reward.cost.gold);
});
