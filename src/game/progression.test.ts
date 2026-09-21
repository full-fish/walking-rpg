import { expect, test } from 'vitest';

import { defaultSave, type Save } from '../save/schema';
import {
  DEATH_GOLD_LOSS,
  HP_REGEN_INTERVAL_MS,
  POINTS_PER_LEVEL,
  expToNext,
  monsterExp,
  monsterGold,
} from './formulas';
import {
  addExp,
  applyRegen,
  killReward,
  regenHp,
  settleBattle,
  spendPoint,
  statsOf,
} from './progression';

const MIN = 60_000;
const at = (level = 1, over: Partial<Save['player']> = {}): Save => ({
  ...defaultSave(),
  player: { ...defaultSave().player, level, ...over },
});

test('필요 EXP가 §6.2 표와 맞는다', () => {
  expect(expToNext(1)).toBe(168);
  expect(expToNext(5)).toBe(316);
  expect(expToNext(10)).toBe(609);
  expect(expToNext(20)).toBe(1_522);
  expect(expToNext(30)).toBe(2_929);
  expect(expToNext(49)).toBe(7_438);
});

test('개별 보상은 몬스터 기본값의 54% (§4.4)', () => {
  // 기본값은 gen-content가 §6.2·§6.3 공식으로 뽑아 몬스터에 박아둔다.
  // 지역1 티어3 기본 골드는 §6.3 표에서 55
  expect(monsterGold(1, 3)).toBeCloseTo(55.1, 1);
  expect(killReward({ exp: 100, gold: 55 })).toEqual({ exp: 54, gold: 30 });

  // 약한 원형은 보상도 비례해서 적다 (§7.2③)
  expect(monsterExp(1, 1, 0.7)).toBeLessThan(monsterExp(1, 1, 1.0));
});

test('EXP가 넘치면 한 번에 여러 레벨이 오른다', () => {
  expect(addExp(1, 0, 100)).toEqual({ level: 1, exp: 100, levelsGained: 0 });
  expect(addExp(1, 0, 168)).toEqual({ level: 2, exp: 0, levelsGained: 1 });
  expect(addExp(1, 167, 1)).toEqual({ level: 2, exp: 0, levelsGained: 1 });

  const big = addExp(1, 0, 10_000);
  expect(big.levelsGained).toBeGreaterThan(1);
  expect(big.exp).toBeLessThan(expToNext(big.level));

  // 음수 EXP는 무시한다 — 레벨이 내려가는 일은 없다
  expect(addExp(5, 50, -999)).toEqual({ level: 5, exp: 50, levelsGained: 0 });
});

test('HP 회복은 10분당 1%, 만피를 넘지 않는다 (§4.2)', () => {
  expect(regenHp(50, 100, 0, 9 * MIN)).toEqual({ hp: 50, updatedAt: 0 });
  expect(regenHp(50, 100, 0, 10 * MIN)).toEqual({ hp: 51, updatedAt: HP_REGEN_INTERVAL_MS });
  expect(regenHp(50, 100, 0, 100 * MIN).hp).toBe(60);
  expect(regenHp(99, 100, 0, 600 * MIN).hp).toBe(100);
});

test('회복하고 남은 자투리 시간은 다음 계산으로 넘어간다', () => {
  // 25분 → 2틱 쓰고 5분이 남는다. 5분 뒤에 또 부르면 3틱째가 채워진다.
  const first = regenHp(50, 100, 0, 25 * MIN);
  expect(first.hp).toBe(52);
  expect(regenHp(first.hp, 100, first.updatedAt, 30 * MIN).hp).toBe(53);
});

test('시계를 뒤로 돌려도 회복되지 않고, 앞으로 돌려도 하루치가 상한 (§4.2)', () => {
  // 경과가 음수면 회복 0. 기준 시각만 따라 내린다
  expect(regenHp(50, 100, 100 * MIN, 10 * MIN)).toEqual({ hp: 50, updatedAt: 10 * MIN });
  // 한 달을 안 켰어도 한 번에 24시간치(144틱 = 144%)까지만
  const month = regenHp(1, 100, 0, 30 * 24 * 60 * MIN);
  expect(month.hp).toBe(100);
  expect(month.updatedAt).toBe(24 * 60 * MIN);
});

test('applyRegen은 회복할 게 없으면 세이브를 그대로 돌려준다', () => {
  const save = { ...at(1, { hp: 50 }), hpUpdatedAt: 0 };
  expect(applyRegen(save, 1 * MIN)).toBe(save);
  expect(applyRegen(save, 10 * MIN).player.hp).toBe(51);
});

test('승리 — 보상 지급, HP는 싸우고 남은 만큼 유지 (§4.2)', () => {
  const save = { ...at(1, { hp: 80, gold: 100 }), hpUpdatedAt: 0 };
  const s = settleBattle(save, 'win', 62, { exp: 10, gold: 17 }, 5 * MIN);

  expect(s.save.player).toMatchObject({ level: 1, exp: 10, gold: 117, hp: 62 });
  expect(s.save.hpUpdatedAt).toBe(5 * MIN);
  expect(s.levelsGained).toBe(0);
});

test('레벨업하면 포인트 3점을 받고 늘어난 최대 HP만큼 현재 HP도 오른다', () => {
  const save = { ...at(1, { hp: 60, exp: 160 }), hpUpdatedAt: 0 };
  const s = settleBattle(save, 'win', 60, { exp: 10, gold: 0 }, 0);

  expect(s.levelsGained).toBe(1);
  expect(s.save.player.level).toBe(2);
  expect(s.save.statPoints.unspent).toBe(POINTS_PER_LEVEL);
  // Lv1 maxHp 100 → Lv2(미배분) 114. 다친 40은 그대로 두고 14만 더한다
  expect(statsOf(s.save).maxHp).toBe(114);
  expect(s.save.player.hp).toBe(74);
});

test('도망 — 보상 없이 그 시점 HP만 남는다 (§4.2)', () => {
  const save = { ...at(1, { hp: 80, gold: 100, exp: 50 }), hpUpdatedAt: 0 };
  const s = settleBattle(save, 'flee', 31, { exp: 10, gold: 17 }, 0);

  expect(s.save.player).toMatchObject({ hp: 31, gold: 100, exp: 50 });
  expect(s.gained).toEqual({ exp: 0, gold: 0 });
});

test('사망 — 소지 골드 10% 잃고 최대 HP의 10%로 부활 (§4.2)', () => {
  const save = { ...at(1, { hp: 5, gold: 1_000 }), hpUpdatedAt: 0 };
  const s = settleBattle(save, 'lose', 0, { exp: 10, gold: 17 }, 0);

  expect(s.goldLost).toBe(1_000 * DEATH_GOLD_LOSS);
  expect(s.save.player.gold).toBe(900);
  expect(s.save.player.hp).toBe(10);
  expect(s.gained).toEqual({ exp: 0, gold: 0 });
});

test('사망해도 HP가 0으로 남지 않는다 — 영원히 못 싸우는 상태가 없어야 한다', () => {
  const broke = { ...at(1, { hp: 0, gold: 0 }), hpUpdatedAt: 0 };
  const s = settleBattle(broke, 'lose', 0, { exp: 0, gold: 0 }, 0);
  expect(s.save.player.hp).toBeGreaterThan(0);
  expect(s.save.player.gold).toBe(0);
});

test('스탯 배분 — 포인트가 있어야 쓰이고 VIT는 현재 HP도 올린다', () => {
  const save: Save = {
    ...at(2, { hp: 50 }),
    statPoints: { unspent: 2, str: 0, vit: 0, agi: 0, luk: 0 },
  };

  const vit = spendPoint(save, 'vit');
  expect(vit?.statPoints).toMatchObject({ unspent: 1, vit: 1 });
  expect(statsOf(vit!).maxHp - statsOf(save).maxHp).toBe(10);
  expect(vit!.player.hp).toBe(60);

  // STR은 최대 HP와 무관하므로 현재 HP를 건드리지 않는다
  const str = spendPoint(save, 'str');
  expect(str!.player.hp).toBe(50);
  expect(statsOf(str!).atk - statsOf(save).atk).toBe(2);

  // 포인트가 없으면 null
  expect(spendPoint({ ...save, statPoints: { ...save.statPoints, unspent: 0 } }, 'str')).toBeNull();
});

test('전투 → 보상 → 레벨업 → 저장 한 바퀴 (T9 완료 기준)', () => {
  let save = defaultSave();
  // 가장 약한 원형(슬라임 power 0.70) 티어1의 기본 보상
  const reward = killReward({
    exp: monsterExp(1, 1, 0.7),
    gold: monsterGold(1, 1, 0.7),
  });

  // 한 마리에 EXP 4 — 42마리에 레벨 하나다
  const kills = 50;
  for (let i = 0; i < kills; i++) {
    save = settleBattle(save, 'win', statsOf(save).maxHp, reward, i * MIN).save;
  }

  expect(save.player.level).toBeGreaterThan(1);
  expect(save.player.gold).toBe(reward.gold * kills);
  expect(save.statPoints.unspent).toBe((save.player.level - 1) * POINTS_PER_LEVEL);
  expect(save.player.exp).toBeLessThan(expToNext(save.player.level));
});
