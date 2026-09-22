import { expect, test } from 'vitest';

import { gearSetFor } from '../content';
import { defaultSave, type Save } from '../save/schema';
import { makeRng } from './battle';
import { GEAR_SLOTS } from './formulas';
import { equippedStats, itemLabel, itemStats, makeItem, nextUid, setBonus } from './items';
import { addItem, equipAll, equipItem, statsOf, unequipSlot } from './progression';

/** 그 레벨 common 풀세트를 다 껴 입은 세이브. 밸런스 기준선과 같은 상태다 (§4.5). */
function geared(level: number, seed = 1): Save {
  const rng = makeRng(seed);
  let save: Save = { ...defaultSave(), player: { ...defaultSave().player, level } };
  const uids: string[] = [];
  for (const def of gearSetFor(level)) {
    const item = makeItem(save.inventory, def.id, rng);
    save = addItem(save, item);
    uids.push(item.uid);
  }
  return equipAll(save, uids);
}

test('부위마다 성격이 다르다 — 무기는 ATK만, 장신구는 LUK만 (§4.5, T16_1)', () => {
  const set = gearSetFor(30);
  const bySlot = (slot: string) => set.find((e) => e.slot === slot)!;

  expect(bySlot('weapon').maxHp, '무기는 HP를 안 준다').toBe(0);
  expect(bySlot('weapon').def).toBe(0);
  expect(bySlot('boots').spd, '신발이 장비 SPD를 전부 갖는다').toBeGreaterThan(0);
  for (const slot of GEAR_SLOTS) {
    if (slot === 'boots') continue;
    expect(bySlot(slot).spd, `${slot}은 SPD를 안 준다`).toBe(0);
    if (slot !== 'accessory') expect(bySlot(slot).luk, `${slot}은 LUK을 안 준다`).toBe(0);
  }
  expect(bySlot('accessory').luk, '장신구가 LUK을 전부 갖는다').toBeGreaterThan(0);

  // 장신구의 LUK은 1차 스탯이라 파생 4종에 전부 얹힌다 (§4.3)
  const naked = statsOf({ ...defaultSave(), player: { ...defaultSave().player, level: 30 } });
  const full = statsOf(geared(30));
  expect(full.dropMult).toBeGreaterThan(naked.dropMult);
  expect(full.goldMult).toBeGreaterThan(naked.goldMult);
  expect(full.cri).toBeGreaterThan(naked.cri);
  expect(full.crd).toBeGreaterThan(naked.crd);
});

test('uid는 세이브 안에서만 안 겹치면 된다 — 가진 것 중 가장 큰 번호 + 1', () => {
  expect(nextUid([])).toBe('1');
  const rng = makeRng(1);
  let save = defaultSave();
  for (let i = 0; i < 3; i++) {
    save = addItem(save, makeItem(save.inventory, 'eq_t1_weapon_common', rng));
  }
  expect(save.inventory.map((i) => i.uid)).toEqual(['1', '2', '3']);
});

test('없는 정의로는 개체를 못 만든다 — 세이브에 유령 uid가 남지 않게', () => {
  expect(() => makeItem([], 'eq_t99_weapon_common', makeRng(1))).toThrow();
});

test('개체 스탯 = 정의 × 품질 × 1.1^강화 (§4.5)', () => {
  const base = itemStats({ uid: '1', defId: 'eq_t10_weapon_common', quality: 1.0, enhance: 0 });
  const good = itemStats({ uid: '2', defId: 'eq_t10_weapon_common', quality: 1.2, enhance: 0 });
  const forged = itemStats({ uid: '3', defId: 'eq_t10_weapon_common', quality: 1.0, enhance: 10 });

  expect(good.atk / base.atk).toBeCloseTo(1.2, 2);
  expect(forged.atk / base.atk).toBeCloseTo(2.59, 2);
  expect(itemLabel({ uid: '4', defId: 'eq_t10_weapon_common', quality: 1.14, enhance: 3 })).toBe(
    '심연 검 +3 (114%)',
  );
});

test('장착하면 전투 스탯이 바뀐다 — 기준선은 그 레벨 common 풀세트 (§4.5)', () => {
  const naked = { ...defaultSave(), player: { ...defaultSave().player, level: 30 } };
  const save = geared(30);

  expect(Object.values(save.equipped).filter(Boolean)).toHaveLength(GEAR_SLOTS.length);
  // 품질이 0.8~1.2로 굴러가므로 정의 합과 정확히 같진 않다. 절반 이상 얹어주면 된다
  expect(statsOf(save).atk).toBeGreaterThan(statsOf(naked).atk * 1.5);
  expect(equippedStats(save).maxHp).toBeGreaterThan(setBonus(gearSetFor(30)).maxHp * 0.7);
});

test('요구 레벨이 모자라면 못 낀다 — null로 돌려줘 호출부가 확인하게 한다', () => {
  let save = defaultSave();
  const item = makeItem(save.inventory, 'eq_t10_weapon_common', makeRng(1));
  save = addItem(save, item);

  expect(equipItem(save, item.uid)).toBeNull();
  expect(equipItem(save, '없는uid')).toBeNull();
});

test('벗어도 HP가 최대치를 넘지 않는다 — 넘으면 체력바가 깨진다', () => {
  const save = geared(20);
  const full = { ...save, player: { ...save.player, hp: statsOf(save).maxHp } };

  const stripped = unequipSlot(full, 'armor');
  expect(stripped.player.hp).toBeLessThanOrEqual(statsOf(stripped).maxHp);
  expect(stripped.player.hp).toBeGreaterThan(0);
  // 벗은 건 버려지지 않는다 — 가방에 그대로 있어야 다시 낄 수 있다
  expect(stripped.inventory).toHaveLength(GEAR_SLOTS.length);
});

test('같은 부위를 갈아 끼우면 칸이 하나로 유지된다', () => {
  const rng = makeRng(3);
  let save = geared(30);
  const better = makeItem(save.inventory, 'eq_t7_weapon_epic', rng);
  save = addItem(save, better);

  const swapped = equipItem(save, better.uid)!;
  expect(swapped.equipped.weapon).toBe(better.uid);
  expect(statsOf(swapped).atk).toBeGreaterThan(statsOf(save).atk);
});
