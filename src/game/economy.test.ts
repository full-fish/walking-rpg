import { expect, test } from 'vitest';

import { equipmentById, regionById, shopGear } from '../content';
import { defaultSave, type Save } from '../save/schema';
import { makeRng } from './battle';
import {
  bagExpand,
  buyConsumable,
  buyEquipment,
  depositNet,
  enhanceItem,
  enhanceRing,
  exchangeRing,
  potionHeal,
  ringNext,
  sellItem,
  upgradeRing,
  sellPrice,
  stayInn,
  consumeItem,
  vaultDeposit,
  vaultExpand,
  vaultWithdraw,
} from './economy';
import {
  BAG,
  bagExpandCost,
  DEATH_GOLD_LOSS,
  ENHANCE_MAX,
  enhanceCost,
  enhanceExpected,
  innCost,
  RING_COST,
  VAULT,
  vaultExpandCost,
} from './formulas';
import { bagFull, bagItems, itemStats } from './items';
import { addItem, equipItem, settleBattle, sortInventory, statsOf, unequipSlot } from './progression';

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

test('전설은 상점에 없다 — 드랍으로만 나온다 (T17_6)', () => {
  expect(buyEquipment(rich(1_000_000), 'eq_t1_weapon_legendary', rng)).toBeNull();
  expect(buyEquipment(rich(1_000_000), 'eq_t1_weapon_epic', rng)).not.toBeNull();
  expect(shopGear(5).some((e) => e.rarity === 'legendary')).toBe(false);
  // 전에는 앞 12개만 보여서 하의가 안 보였다 — 목록 자체에는 7부위가 다 있어야 한다
  expect(new Set(shopGear(1).map((e) => e.slot)).size).toBe(7);
});

test('상점은 지금 지역의 티어 두 개만 판다 — 레벨이 아니라 지역이 정한다 (T17_6 검수)', () => {
  expect([...new Set(shopGear(1).map((e) => e.tier))]).toEqual([2, 1]);
  expect([...new Set(shopGear(2).map((e) => e.tier))]).toEqual([4, 3]);
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

/** 그 지역 사냥터 소재를 곳마다 n개씩 */
function materialsOf(region: number, n: number): Record<string, number> {
  return Object.fromEntries(regionById(region).fields.map((f) => [f.id, n]));
}

test('반지 교환 — 초원 소재 서로 다른 3곳 → ★1 일반, 효과는 무작위 (T17_7)', () => {
  const [a, b, c] = regionById(1).fields.map((f) => f.id);
  // 한 곳 소재만 잔뜩 있어도 안 된다 — 서로 다른 사냥터에서 하나씩이다
  expect(exchangeRing({ ...rich(0), materials: { [a]: 9 } }, rng)).toBeNull();

  const got = exchangeRing({ ...rich(0), materials: { [a]: 2, [b]: 1, [c]: 1 } }, makeRng(3))!;
  expect(got.rings).toHaveLength(1);
  expect(got.rings[0]).toMatchObject({ tier: 1, rarity: 'common', enhance: 0 });
  expect(got.materials, '곳마다 하나씩 뺀다').toEqual({ [a]: 1 });
  expect(got.player.gold, '골드는 안 든다').toBe(0);

  // 무작위라 여러 번 바꾸면 여러 종류가 나온다 — 같은 게 또 나와도 된다
  const kinds = new Set<string>();
  let save: Save = { ...rich(0), materials: materialsOf(1, 99) };
  for (let i = 0; i < 30; i++) {
    save = exchangeRing(save, makeRng(i))!;
    kinds.add(save.rings.at(-1)!.kind);
  }
  expect(kinds.size).toBeGreaterThan(5);
});

test('반지 올리기 — 소재만 들고, 강화는 +0으로. 전설 다음은 다음 지역 소재로 ★2 일반 (T17_7)', () => {
  const ring = { uid: '1', kind: 'gold' as const, tier: 1, rarity: 'common' as const, enhance: 4 };
  const save: Save = { ...rich(0), rings: [ring], materials: materialsOf(1, 9) };

  expect(ringNext(ring)).toEqual({ tier: 1, rarity: 'uncommon', cost: RING_COST.rarity[0] });
  const up = upgradeRing(save, '1')!;
  expect(up.rings[0]).toMatchObject({ tier: 1, rarity: 'uncommon', enhance: 0 });

  // 전설 → ★2 일반은 숲(지역 2) 소재가 든다. 초원 소재만으로는 못 간다
  const legend = { ...ring, rarity: 'legendary' as const };
  expect(ringNext(legend)).toEqual({ tier: 2, rarity: 'common', cost: RING_COST.tier });
  expect(upgradeRing({ ...save, rings: [legend] }, '1')).toBeNull();
  const tier2 = upgradeRing({ ...save, rings: [legend], materials: materialsOf(2, 1) }, '1')!;
  expect(tier2.rings[0]).toMatchObject({ tier: 2, rarity: 'common', enhance: 0 });

  // ★5 전설이 끝이다
  expect(ringNext({ ...ring, tier: 5, rarity: 'legendary' })).toBeNull();
});

test('반지 강화 — 장비와 같은 표. +6부터 그 ★ 지역 소재가 성공할 때만 든다 (T17_7)', () => {
  const ring = { uid: '1', kind: 'exp' as const, tier: 1, rarity: 'rare' as const, enhance: 5 };
  const save: Save = { ...rich(10_000_000), rings: [ring] };
  // 소재가 없으면 +6을 못 두드린다
  expect(enhanceRing(save, '1', () => 0)).toBeNull();

  const mats = { ...save, materials: materialsOf(1, 1) };
  const fail = enhanceRing(mats, '1', () => 0.99)!;
  expect(fail.success).toBe(false);
  expect(fail.save.materials, '실패하면 소재는 그대로').toEqual(mats.materials);
  const ok = enhanceRing(mats, '1', () => 0)!;
  expect(ok.save.rings[0].enhance).toBe(6);
  expect(ok.materials).toBe(1);
  expect(ok.cost).toBe(fail.cost);
});

test('물약 반지는 회복량을 늘린다 — 마을·사냥터가 같은 값을 본다 (T17_7)', () => {
  const ring = {
    uid: '1',
    kind: 'potion' as const,
    tier: 1,
    rarity: 'common' as const,
    enhance: 0,
  };
  const plain: Save = { ...rich(0), consumables: { pot_small: 1 } };
  const worn: Save = { ...plain, rings: [ring], ringSlots: ['1', null] };
  expect(potionHeal(worn, 'pot_small')).toBe(Math.round(potionHeal(plain, 'pot_small') * 1.1));
  // 가지고만 있고 안 끼면 아무 일도 없다
  expect(potionHeal({ ...plain, rings: [ring] }, 'pot_small')).toBe(potionHeal(plain, 'pot_small'));
});

test('강화 — §4.5 표 그대로. 실패해도 단계가 안 내려간다', () => {
  const def = equipmentById('eq_t5_weapon_common');
  let save = buyEquipment(rich(10_000_000), def.id, rng)!;
  const uid = save.inventory[0].uid;

  // §4.5 비용 곡선 — 장비가격 × 0.3 × 1.5^(N-1)
  expect(enhanceCost(def.price, 1)).toBe(Math.round(def.price * 0.3));
  expect(enhanceCost(def.price, 10)).toBe(Math.round(def.price * 0.3 * 1.5 ** 9));

  // +1·+2는 확정이다 (성공률 100%) — 난수가 뭐가 나오든 붙는다
  for (let step = 1; step <= 2; step++) {
    const r = enhanceItem(save, uid, () => 0.999)!;
    expect(r.success, `+${step}`).toBe(true);
    save = r.save;
  }
  expect(save.inventory[0].enhance).toBe(2);

  // +3(90%)을 반드시 실패하는 난수로 두드리면 단계는 2 그대로, 골드만 나간다
  const gold = save.player.gold;
  const failed = enhanceItem(save, uid, () => 0.999)!;
  expect(failed.success).toBe(false);
  expect(failed.save.inventory[0].enhance, '실패해도 안 내려간다').toBe(2);
  expect(gold - failed.save.player.gold).toBe(failed.cost);
  expect(failed.cost).toBe(enhanceCost(def.price, 3));

  // 상한에 닿으면 null — 호출부가 더 못 올린다는 걸 이걸로 안다
  const maxed = { ...save, inventory: [{ ...save.inventory[0], enhance: ENHANCE_MAX }] };
  expect(enhanceItem(maxed, uid, rng)).toBeNull();
  expect(enhanceItem(save, '없는uid', rng)).toBeNull();
});

test('+6부터는 그 지역 소재가 서로 다른 사냥터에서 1·2·3·4·7개 든다 — 성공할 때만 쓴다 (T17_6 검수)', () => {
  const def = equipmentById('eq_t5_weapon_common'); // 티어 5 = 지역 3
  const [a, b, ...rest] = regionById(def.region).fields.map((f) => f.id);
  let save = buyEquipment(rich(100_000_000), def.id, rng)!;
  const uid = save.inventory[0].uid;
  save = { ...save, inventory: [{ ...save.inventory[0], enhance: 5 }] };

  // 소재가 없으면 골드가 있어도 못 두드린다
  expect(enhanceItem(save, uid, () => 0)).toBeNull();

  // +6은 아무 사냥터 하나 — 가진 게 많은 곳부터 쓴다
  save = { ...save, materials: { [a]: 1, [b]: 3 } };
  const six = enhanceItem(save, uid, () => 0)!;
  expect(six.materials).toBe(1);
  expect(six.save.materials).toEqual({ [a]: 1, [b]: 2 });

  // 실패하면 골드만 나가고 소재는 그대로다
  const failed = enhanceItem(six.save, uid, () => 0.999)!;
  expect(failed.success).toBe(false);
  expect(failed.save.materials).toEqual(six.save.materials);

  // +7은 서로 다른 두 곳 — 한 곳에 아무리 많아도 안 된다
  expect(enhanceItem({ ...six.save, materials: { [b]: 9 } }, uid, () => 0)).toBeNull();
  const seven = enhanceItem(six.save, uid, () => 0)!;
  expect(seven.save.materials).toEqual({ [b]: 1 });

  // +10은 그 지역 일곱 곳 전부 — 여섯 곳이면 못 간다
  const all = [a, b, ...rest];
  const at9 = { ...seven.save, inventory: [{ ...seven.save.inventory[0], enhance: 9 }] };
  const one = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 1]));
  expect(enhanceItem({ ...at9, materials: one(all.slice(0, 6)) }, uid, () => 0)).toBeNull();
  const ten = enhanceItem({ ...at9, materials: one(all) }, uid, () => 0)!;
  expect(ten.save.inventory[0].enhance).toBe(10);
  expect(ten.save.materials).toEqual({});
});

test('레벨이 모자라도 장비는 산다 — 미리 사 두고 레벨이 되면 낀다 (T17_6 검수)', () => {
  const def = equipmentById('eq_t4_weapon_common');
  expect(def.level).toBeGreaterThan(1);
  const bought = buyEquipment(rich(1_000_000), def.id, rng)!;
  expect(bought.inventory).toHaveLength(1);
  expect(equipItem(bought, bought.inventory[0].uid), '끼는 건 레벨이 돼야 한다').toBeNull();
});

test('강화는 인스턴스 단위다 — 같은 이름 둘이 섞이면 안 된다 (§4.5)', () => {
  let save = buyEquipment(rich(10_000_000), 'eq_t5_weapon_common', rng)!;
  save = buyEquipment(save, 'eq_t5_weapon_common', rng)!;

  const [a, b] = save.inventory;
  const after = enhanceItem(save, a.uid, () => 0)!.save;
  expect(after.inventory.find((i) => i.uid === a.uid)!.enhance).toBe(1);
  expect(after.inventory.find((i) => i.uid === b.uid)!.enhance).toBe(0);
});

test('★ +10 기대 시도 33.3회 · 기대 골드를 난수로 재현한다 (§4.5)', () => {
  const def = equipmentById('eq_t5_weapon_common');
  const want = enhanceExpected(def.price);
  expect(want.tries).toBeCloseTo(33.33, 1);

  // 실제로 1,000번 키워보고 평균이 기댓값과 맞는지 본다
  const RUNS = 1_000;
  let tries = 0;
  let gold = 0;
  for (let seed = 0; seed < RUNS; seed++) {
    const r = makeRng(seed);
    // +6부터 드는 소재는 넉넉히 — 성공할 때만 쓰므로 시도 수·골드에는 안 끼어든다 (T17_6 검수)
    let save = {
      ...defaultSave(),
      player: { ...defaultSave().player, gold: 100_000_000 },
      materials: Object.fromEntries(regionById(def.region).fields.map((f) => [f.id, 100])),
    };
    save = buyEquipment(save, def.id, rng)!;
    const uid = save.inventory[0].uid;
    const start = save.player.gold;
    while (save.inventory[0].enhance < ENHANCE_MAX) {
      save = enhanceItem(save, uid, r)!.save;
      tries += 1;
    }
    gold += start - save.player.gold;
  }

  expect(tries / RUNS, '평균 시도').toBeCloseTo(want.tries, 0);
  expect(Math.abs(gold / RUNS - want.gold) / want.gold, '평균 골드 오차').toBeLessThan(0.1);
});

test('+10 최종 배율이 §4.5 표와 맞는다 (80% 2.08 / 100% 2.59 / 120% 3.11)', () => {
  for (const [quality, table] of [
    [0.8, 2.08],
    [1.0, 2.59],
    [1.2, 3.11],
  ] as const) {
    const at0 = itemStats({ uid: '1', defId: 'eq_t10_armor_common', quality, enhance: 0 });
    const at10 = itemStats({ uid: '1', defId: 'eq_t10_armor_common', quality, enhance: 10 });
    expect(Math.abs(at10.maxHp / (at0.maxHp / quality) - table), `품질 ${quality}`).toBeLessThan(0.02);
  }
});

test('낀 장비를 강화하면 현재 HP도 같이 오른다 (장착과 같은 규칙)', () => {
  let save = buyEquipment(rich(10_000_000, { level: 20 }), 'eq_t5_armor_common', rng)!;
  const uid = save.inventory[0].uid;
  save = equipItem(save, uid)!;
  save = { ...save, player: { ...save.player, hp: statsOf(save).maxHp } };

  const before = statsOf(save).maxHp;
  const after = enhanceItem(save, uid, () => 0)!.save;
  expect(statsOf(after).maxHp).toBeGreaterThan(before);
  expect(after.player.hp).toBe(statsOf(after).maxHp);
});

test('가방 — 낀 장비는 칸을 안 쓴다 (§4.5, T17_2)', () => {
  let save = rich(1_000_000);
  expect(save.bag.capacity).toBe(BAG.capacity);

  // 기본 20칸을 꽉 채운다
  for (let i = 0; i < BAG.capacity; i++) {
    save = buyEquipment(save, 'eq_t1_weapon_common', rng)!;
  }
  expect(bagItems(save)).toHaveLength(BAG.capacity);
  expect(bagFull(save)).toBe(true);
  expect(buyEquipment(save, 'eq_t1_weapon_common', rng), '차면 안 판다').toBeNull();

  // 하나 끼면 가방에서 빠진다 — 낀 건 몸에 있지 가방에 있는 게 아니다
  const equipped = equipItem(save, save.inventory[0].uid)!;
  expect(bagItems(equipped)).toHaveLength(BAG.capacity - 1);
  expect(bagFull(equipped)).toBe(false);
  expect(buyEquipment(equipped, 'eq_t1_weapon_common', rng), '자리가 생겼다').not.toBeNull();
});

test('가방이 차 있으면 장비를 못 벗는다 (T17_2)', () => {
  let save = rich(1_000_000);
  save = buyEquipment(save, 'eq_t1_weapon_common', rng)!;
  save = equipItem(save, save.inventory[0].uid)!;

  // 낀 것 하나 + 가방 20칸이 꽉 찬 상태
  for (let i = 0; i < BAG.capacity; i++) {
    save = buyEquipment(save, 'eq_t1_helm_common', rng)!;
  }
  expect(bagFull(save)).toBe(true);
  expect(unequipSlot(save, 'weapon'), '벗을 자리가 없다').toBe(save);

  // 한 칸 비우면 벗어진다
  const sold = sellItem(save, bagItems(save)[0].uid)!;
  expect(unequipSlot(sold, 'weapon').equipped.weapon).toBeNull();
});

test('가방 확장 — 값이 1.6배씩 오르고 8회가 상한이다 (§4.5, T17_2)', () => {
  let save = rich(10_000_000);
  const first = bagExpandCost(0);
  expect(bagExpand(rich(first - 1)), '골드가 모자라면 null').toBeNull();

  for (let i = 0; i < BAG.maxExpansions; i++) {
    const before = save.player.gold;
    save = bagExpand(save)!;
    expect(before - save.player.gold).toBe(bagExpandCost(i));
  }
  expect(save.bag.capacity).toBe(BAG.capacity + BAG.step * BAG.maxExpansions);
  expect(bagExpand(save), '9회째는 거부').toBeNull();
});

test('성능순 정렬 — 누른 그 시점 기준이고, 뒤에 얻은 건 맨 뒤로 간다 (T17_2)', () => {
  const base = rich(0);
  const item = (uid: string, defId: string) => ({ uid, defId, quality: 1, enhance: 0 });
  // 일부러 약한 것부터가 아닌 순서로 넣는다
  let save: Save = { ...base, inventory: [] };
  save = addItem(save, item('1', 'eq_t3_weapon_common'));
  save = addItem(save, item('2', 'eq_t9_weapon_common'));
  save = addItem(save, item('3', 'eq_t6_weapon_common'));

  const sorted = sortInventory(save);
  expect(sorted.inventory.map((i) => i.uid)).toEqual(['2', '3', '1']);

  // 정렬 뒤에 얻은 건 성능과 상관없이 맨 뒤다 — 정렬은 상태가 아니라 한 번의 동작이다
  const later = addItem(sorted, item('4', 'eq_t10_weapon_common'));
  expect(later.inventory.map((i) => i.uid)).toEqual(['2', '3', '1', '4']);
  expect(sortInventory(later).inventory.map((i) => i.uid)).toEqual(['4', '2', '3', '1']);
});
