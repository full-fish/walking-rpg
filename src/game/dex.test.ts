import { expect, test } from 'vitest';

import { bossOf, fieldById, monstersOfField } from '../content';
import { defaultSave, type Save } from '../save/schema';
import { dexDropMult, dexStage, dexStat, dexStats, DEX_MONSTERS, recordKill } from './dex';
import { DEX, DEX_MAX } from './formulas';
import { statsOf } from './progression';

const meadow = fieldById('f_r1_meadow');
const slime = monstersOfField(meadow)[0];

/** 몬스터들을 n마리씩 잡은 세이브 */
function killed(ids: string[], n: number, save: Save = defaultSave()): Save {
  return { ...save, dex: { ...save.dex, ...Object.fromEntries(ids.map((id) => [id, n])) } };
}

test('카드 단계 — 1 · 10 · 25 · 50 · 100마리, 보스는 한 번에 끝 단계', () => {
  expect([0, 1, 9, 10, 25, 49, 50, 99, 100].map((k) => dexStage(slime, k))).toEqual([
    0, 1, 1, 2, 3, 3, 4, 4, 5,
  ]);
  expect(dexStage(bossOf(1), 1)).toBe(DEX.steps.length);
});

test('잡으면 +1, 단계가 오를 때만 알린다, 100에서 멈춘다', () => {
  const first = recordKill(defaultSave(), slime);
  expect(first.save.dex[slime.id]).toBe(1);
  expect(first.up?.stage).toBe(1);
  expect(recordKill(first.save, slime).up).toBeNull();

  const capped = killed([slime.id], DEX_MAX);
  expect(recordKill(capped, slime).save).toBe(capped);
});

test('10마리부터 그 몬스터 장비 드랍 ×1.5', () => {
  expect(dexDropMult(killed([slime.id], 9), slime)).toBe(1);
  expect(dexDropMult(killed([slime.id], 10), slime)).toBe(DEX.dropMult);
});

test('100마리 카드는 원형 스탯 +1 — statsOf까지 오른다', () => {
  const before = statsOf(defaultSave());
  const save = killed([slime.id], DEX_MAX);
  const stat = dexStat(slime);
  expect(dexStats(save)[stat]).toBe(DEX.cardStat);
  // 점액은 체력 — 최대 HP가 오른다
  expect(stat).toBe('vit');
  expect(statsOf(save).maxHp).toBeGreaterThan(before.maxHp);
});

test('사냥터를 다 채우는 한 마리 — 스탯 포인트 +1, 한 번만', () => {
  const [last, ...rest] = monstersOfField(meadow);
  const almost = killed(
    [last.id],
    DEX_MAX - 1,
    killed(
      rest.map((m) => m.id),
      DEX_MAX,
    ),
  );
  const done = recordKill(almost, last);
  expect(done.up?.fields.map((f) => f.id)).toContain(meadow.id);
  expect(done.save.statPoints.unspent).toBe(almost.statPoints.unspent + DEX.fieldPoints);
  expect(recordKill(done.save, last).save.statPoints.unspent).toBe(done.save.statPoints.unspent);
});

test('지역을 다 채우면 네 스탯 +2 (카드 몫과 따로)', () => {
  const ids = DEX_MONSTERS.get(1)!.map((m) => m.id);
  const [first, ...rest] = DEX_MONSTERS.get(1)!;
  const almost = killed(
    [first.id],
    DEX_MAX - 1,
    killed(
      rest.map((m) => m.id),
      DEX_MAX,
    ),
  );
  const done = recordKill(almost, first);
  expect(done.up?.region).toBe(true);
  const cards = dexStats(killed(ids, DEX_MAX));
  const total = cards.str + cards.vit + cards.agi + cards.luk;
  expect(total).toBe(ids.length * DEX.cardStat + 4 * DEX.regionStat);
});
