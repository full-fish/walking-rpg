import { expect, test } from 'vitest';

import { ARROWS, fieldById, gearSetFor, MONSTERS } from '../content';
import { defaultSave, type Save } from '../save/schema';
import { makeRng } from './battle';
import { buyArrows, setQuiver } from './economy';
import { enterField, settleRun } from './field';
import { ACCURACY, ARROW, STYLE_TRAIT } from './formulas';
import { itemDef, makeItem, rollLine, styleOf } from './items';
import { addItem, equipItem, statsOf } from './progression';

/** 레벨 10에 장비를 가방에 넣어 둔 세이브 — 끼는 건 테스트가 한다 */
function holding(defIds: string[], over: Partial<Save> = {}): Save {
  let save: Save = {
    ...defaultSave(),
    player: { ...defaultSave().player, level: 10, gold: 100_000 },
    ...over,
  };
  for (const id of defIds) save = addItem(save, makeItem(save.inventory, id, makeRng(1)));
  return save;
}

const uid = (save: Save, defId: string, nth = 0) =>
  save.inventory.filter((i) => i.defId === defId)[nth].uid;

test('계열은 오른손 무기가 정한다 — 특성이 statsOf에 얹히고 1점 값은 그대로다 (T18)', () => {
  const lines = ['longsword', 'shortsword', 'dagger', 'greatsword', 'bow'] as const;
  const save = holding(lines.map((l) => `eq_t3_${l}_common`));
  const wear = (line: (typeof lines)[number]) =>
    equipItem(save, uid(save, `eq_t3_${line}_common`))!;

  expect(styleOf(defaultSave())).toBe('sword');
  expect(lines.map((l) => styleOf(wear(l)))).toEqual(['sword', 'shield', 'dual', 'great', 'bow']);

  const sword = statsOf(wear('longsword'));
  const great = statsOf(wear('greatsword'));
  expect(sword.acc).toBe(STYLE_TRAIT.sword.acc);
  expect(great.acc).toBe(ACCURACY);
  // 강타 — 치명 배율만 +1. 힘 · 체력 · 민첩 · 행운 값은 안 건드린다
  expect(great.crd - sword.crd).toBeCloseTo(STYLE_TRAIT.great.crd);
  expect(great).toMatchObject({ tempo: STYLE_TRAIT.great.tempo, power: STYLE_TRAIT.great.power });
  expect(great.maxHp).toBe(sword.maxHp);
  // 연격 · 막기는 왼손이 있어야 한다
  expect(statsOf(wear('dagger')).hits).toBe(1);
  expect(statsOf(wear('shortsword')).block).toBe(0);
});

test('두 손 칸은 똑같다 — 방패 먼저도 들고, 옆 손엔 짝만. 두 손 무기는 다른 손을 비운다 (T18 확인)', () => {
  let save = holding([
    'eq_t3_shortsword_common',
    'eq_t3_shield_common',
    'eq_t3_dagger_common',
    'eq_t3_dagger_common',
    'eq_t3_longsword_common',
  ]);
  const shield = uid(save, 'eq_t3_shield_common');
  const short = uid(save, 'eq_t3_shortsword_common');
  // 방패 먼저 — 어느 손에든 든다. 방패만 들어도 검과 방패다
  save = equipItem(save, shield, 'weapon')!;
  expect(save.equipped.weapon).toBe(shield);
  expect(styleOf(save)).toBe('shield');
  expect(statsOf(save).block).toBe(STYLE_TRAIT.shield.block);
  // 방패 옆엔 소검만
  expect(equipItem(save, uid(save, 'eq_t3_dagger_common'), 'offhand')).toBeNull();
  expect(equipItem(save, uid(save, 'eq_t3_longsword_common'), 'offhand')).toBeNull();
  save = equipItem(save, short, 'offhand')!;
  expect(save.equipped).toMatchObject({ weapon: shield, offhand: short });

  // 장검(두 손)으로 바꾸면 소검 · 방패가 가방으로 간다. 두 손 무기 옆엔 아무것도 못 든다
  const long = equipItem(save, uid(save, 'eq_t3_longsword_common'))!;
  expect(long.equipped).toMatchObject({
    weapon: uid(long, 'eq_t3_longsword_common'),
    offhand: null,
  });
  expect(styleOf(long)).toBe('sword');
  expect(equipItem(long, shield, 'offhand')).toBeNull();

  // 단검 두 자루 — 두 번째는 알아서 왼손으로 가고 연격이 켜진다
  let dual = equipItem(long, uid(long, 'eq_t3_dagger_common', 0))!;
  dual = equipItem(dual, uid(dual, 'eq_t3_dagger_common', 1))!;
  expect(dual.equipped.offhand).toBe(uid(dual, 'eq_t3_dagger_common', 1));
  expect(statsOf(dual).hits).toBe(STYLE_TRAIT.dual.hits);
});

test('오른손을 바꿔 왼손이 벗겨질 때 가방이 차 있으면 못 바꾼다 (T18)', () => {
  let save = holding(['eq_t3_shortsword_common', 'eq_t3_shield_common', 'eq_t3_bow_common']);
  save = equipItem(save, uid(save, 'eq_t3_shortsword_common'))!;
  save = equipItem(save, uid(save, 'eq_t3_shield_common'))!;
  // 가방에 활 하나 — 활을 끼면 소검 · 방패 둘이 가방으로 온다(칸 +1)
  const tight = { ...save, bag: { ...save.bag, capacity: 1 } };
  expect(equipItem(tight, uid(tight, 'eq_t3_bow_common'))).toBeNull();
  expect(equipItem(save, uid(save, 'eq_t3_bow_common'))?.equipped.offhand).toBeNull();
});

test('부위를 가리지 않는 장비(보스 · 걸음 3만 보)의 손은 지금 계열의 것이다 (T18)', () => {
  let bow = holding(['eq_t3_bow_common']);
  bow = equipItem(bow, uid(bow, 'eq_t3_bow_common'))!;
  let shield = holding(['eq_t3_shortsword_common']);
  shield = equipItem(shield, uid(shield, 'eq_t3_shortsword_common'))!;

  const rng = makeRng(3);
  const hands = (save: Save) =>
    new Set(
      Array.from({ length: 400 }, () => rollLine(save, rng)).filter(
        (l) => !['helm', 'armor', 'pants', 'gloves', 'boots', 'accessory'].includes(l),
      ),
    );
  expect(hands(bow)).toEqual(new Set(['bow']));
  expect(hands(shield)).toEqual(new Set(['shortsword', 'shield']));
});

test('무기를 떨구는 몬스터는 제 줄 2~3개 중 하나를 떨군다 (T18)', () => {
  const goblin = MONSTERS.find((m) => m.id === 'mon_t3_goblin')!;
  expect(goblin.drop).toBe('weapon');
  expect(goblin.weapons).toEqual(['dagger', 'bow', 'shortsword']);

  const field = fieldById('f_r1_goblin');
  const seen = new Set<string>();
  for (let seed = 0; seed < 400 && seen.size < 3; seed++) {
    let save = holding([], { wp: { ...defaultSave().wp, current: 1e6 } });
    save = { ...save, statPoints: { ...save.statPoints, luk: 5000 } };
    const inside = enterField(save, field.id, makeRng(seed))!;
    const run = { ...inside, run: { ...inside.run!, monsterId: goblin.id } };
    const won = settleRun(run, 'win', 100, makeRng(seed), 0);
    if (won.drop) seen.add(itemDef(won.drop).line);
  }
  expect(seen).toEqual(new Set(goblin.weapons));
});

test('화살 — 기본만 묶음으로 사고 처음 산 걸 먹인다. 쏜 만큼 판이 끝날 때 준다 (T18 → T18_1)', () => {
  expect(ARROWS).toHaveLength(5 * 9);
  const [basic, pierce] = ARROWS;
  let save = holding([]);
  save = buyArrows(save, basic.id)!;
  expect(save.arrows[basic.id]).toBe(ARROW.bundle);
  expect(save.quiver).toBe(basic.id);
  expect(buyArrows(save, pierce.id), '특수 화살은 안 판다').toBeNull();
  save = { ...save, arrows: { ...save.arrows, [pierce.id]: 30 } };
  expect(save.quiver, '먹인 게 남아 있으면 그대로').toBe(basic.id);
  expect(setQuiver(save, 'arrow_r5_fire')).toBeNull();
  expect(setQuiver(save, pierce.id)!.quiver).toBe(pierce.id);

  // 활을 들면 먹인 화살이 전투 스탯으로 들어온다
  let bow = holding(['eq_t3_bow_common'], { arrows: save.arrows, quiver: basic.id });
  bow = equipItem(bow, uid(bow, 'eq_t3_bow_common'))!;
  expect(statsOf(bow)).toMatchObject({ arrows: ARROW.bundle, arrow: { atk: basic.atk } });

  const inside = enterField(
    { ...bow, wp: { ...bow.wp, current: 1e6 } },
    'f_r1_meadow',
    makeRng(1),
  )!;
  const shot = settleRun(inside, 'flee', 50, makeRng(1), 0, 30);
  expect(shot.save.arrows[basic.id]).toBe(ARROW.bundle - 30);
});

test('새 게임은 한손검 한 벌이다 — 기준선이 T18 전과 같다 (T18)', () => {
  const set = gearSetFor(1);
  expect(set.map((e) => e.line)).toEqual([
    'longsword',
    'helm',
    'armor',
    'pants',
    'gloves',
    'boots',
    'accessory',
  ]);
  expect(gearSetFor(1, 1, 'common', 'dual').filter((e) => e.line === 'dagger')).toHaveLength(2);
});
