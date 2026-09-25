/**
 * 도감 (T19) — 몬스터마다 잡은 수를 센다.
 *
 * 카드는 1 · 10 · 25 · 50 · 100마리에 한 단계씩 오르고(테두리가 등급 색), 정보가 하나씩 열린다. 보스는 한 번에 한 단계.
 * 10마리부터 그 몬스터의 장비 드랍이 늘고, 100마리면 원형이 정한 1차 스탯이 1 오른다.
 * 사냥터 하나를 다 채우면 스탯 포인트, 지역 하나를 다 채우면 네 스탯이 오른다.
 * 보스는 2번에 그 지역 장비 드랍 ×1.5, 3번에 EXP · 골드 +3%, 4번에 네 스탯 +1,
 * 5번에 강화 성공률 +1%p · 그 지역 전설 비율 ×1.5 (검수 3차).
 * **보상은 전부 잡은 수에서 계산한다** — 받았다는 기록이 따로 없다. 사냥터 포인트만 넘는 순간 준다
 * (자유 배분이라 어디에 넣었는지를 세이브가 기억해야 해서다).
 * React를 import하지 않는다 — 시뮬도 settleRun으로 여기를 지난다.
 */
import {
  bossOf,
  MONSTER_ARCHETYPES,
  MONSTERS,
  REGIONS,
  monstersOfField,
  regionById,
  type Field,
  type Monster,
} from '../content';
import type { Save } from '../save/schema';
import { DEX, DEX_MAX, SPENDABLE_STATS, type SpendableStat } from './formulas';

const STAT_OF_ARCH = new Map(MONSTER_ARCHETYPES.map((a) => [a.id, a.dexStat]));

/** 지역 번호 → 도감에 싣는 몬스터 (보스 빼고). 카드 · 지역 완성이 전부 이걸 센다 */
export const DEX_MONSTERS = new Map(
  REGIONS.map((r) => [r.id, MONSTERS.filter((m) => m.region === r.id && !m.boss)]),
);

/** 그 몬스터 카드를 100마리 채우면 오르는 1차 스탯 — 원형이 정한다 */
export function dexStat(monster: Monster): SpendableStat {
  return STAT_OF_ARCH.get(monster.arch)!;
}

/** 카드 단계를 가르는 처치 수. **보스는 잡을 때마다 한 단계**다 — 재사냥으로 채운다 (T19 검수) */
export function dexSteps(monster: Monster): readonly number[] {
  return monster.boss ? DEX.bossSteps : DEX.steps;
}

/** 카드 단계 0~5 (0 = 아직 못 잡음) */
export function dexStage(monster: Monster, kills: number): number {
  return dexSteps(monster).filter((s) => kills >= s).length;
}

/** 그 몬스터를 잡은 수 */
export function dexKills(save: Save, monster: Monster): number {
  return save.dex[monster.id] ?? 0;
}

/** 그 사냥터 몬스터가 전부 100마리인가 */
export function fieldDone(save: Save, field: Field): boolean {
  return monstersOfField(field).every((m) => dexKills(save, m) >= DEX_MAX);
}

/** 그 지역 몬스터가 전부 100마리인가 */
export function regionDone(save: Save, region: number): boolean {
  return DEX_MONSTERS.get(region)!.every((m) => dexKills(save, m) >= DEX_MAX);
}

/** save.dex 객체 → 계산해 둔 스탯. dex는 잡을 때마다 새 객체라 객체 자체가 키가 된다 */
const statsCache = new WeakMap<Save['dex'], Record<SpendableStat, number>>();

/**
 * 도감이 주는 1차 스탯 — 100마리 카드 + 지역 완성 + 보스 4번. statsOf가 배분 포인트처럼 더한다.
 * 사냥터 완성은 스탯 포인트(자유 배분)로 줘서 여기 없다.
 * statsOf가 전투·시뮬에서 수없이 불려서 141종을 매번 훑지 않게 dex 객체마다 한 번만 센다.
 */
export function dexStats(save: Save): Record<SpendableStat, number> {
  const cached = statsCache.get(save.dex);
  if (cached) return cached;
  const out = { str: 0, vit: 0, agi: 0, luk: 0 };
  for (const monsters of DEX_MONSTERS.values()) {
    let full = 0;
    for (const m of monsters) {
      if (dexKills(save, m) < DEX_MAX) continue;
      out[dexStat(m)] += DEX.cardStat;
      full += 1;
    }
    if (full === monsters.length) for (const k of SPENDABLE_STATS) out[k] += DEX.regionStat;
  }
  // 보스 4번(영웅) — 네 스탯 +1 (T19 검수 3차)
  for (const r of REGIONS) {
    if (bossStage(save, r.id) < DEX.bossStatAt) continue;
    for (const k of SPENDABLE_STATS) out[k] += DEX.bossStat;
  }
  statsCache.set(save.dex, out);
  return out;
}

/** 그 지역 보스 카드의 단계 0~5 */
export function bossStage(save: Save, region: number): number {
  const boss = bossOf(region);
  return dexStage(boss, dexKills(save, boss));
}

/**
 * 보스 카드가 어디서나 주는 것 (T19 검수 3차) — 3번마다 EXP · 골드 +3%, 5번마다 강화 성공률 +1%p.
 * 4번의 네 스탯 +1은 dexStats가, 2번 · 5번의 그 지역 드랍은 bossDrop이 준다.
 */
export function bossBonus(save: Save): { expGold: number; enhance: number } {
  let expGold = 0;
  let enhance = 0;
  for (const r of REGIONS) {
    const stage = bossStage(save, r.id);
    if (stage >= DEX.bossExpGoldAt) expGold += DEX.bossExpGold;
    if (stage === DEX.bossSteps.length) enhance += DEX.bossEnhance;
  }
  return { expGold, enhance };
}

/**
 * 그 지역 사냥터 드랍에 보스 카드가 곱하는 것 (T19 검수 3차) — 2번이면 장비 드랍 ×1.5,
 * 5번이면 전설 비율 ×1.5. 몬스터 도감(10마리) · 행운 배율과 곱한다.
 */
export function bossDrop(save: Save, region: number): { drop: number; legend: number } {
  const stage = bossStage(save, region);
  return {
    drop: stage >= DEX.bossDropAt ? DEX.bossDropMult : 1,
    legend: stage === DEX.bossSteps.length ? DEX.bossLegendMult : 1,
  };
}

/** 장비 드랍 배율 — 그 몬스터를 10마리 넘게 잡았으면 ×1.5 */
export function dexDropMult(save: Save, monster: Monster): number {
  return dexKills(save, monster) >= DEX.dropAt ? DEX.dropMult : 1;
}

/** 카드 단계가 오른 순간 — 전투 결과 화면이 한 줄로 알린다 */
export type DexUp = {
  monster: Monster;
  stage: number;
  /** 이번 처치로 다 찬 사냥터 — 하나에 스탯 포인트 +1을 줬다 */
  fields: Field[];
  /** 이번 처치로 지역 하나가 다 찼다 */
  region: boolean;
};

/** 이겼을 때 부른다. 100에서 멈춘다. 단계가 안 바뀌었으면 up은 null */
export function recordKill(save: Save, monster: Monster): { save: Save; up: DexUp | null } {
  const before = dexKills(save, monster);
  if (before >= DEX_MAX) return { save, up: null };
  const kills = before + 1;
  const next: Save = { ...save, dex: { ...save.dex, [monster.id]: kills } };
  const stage = dexStage(monster, kills);
  if (stage === dexStage(monster, before)) return { save: next, up: null };
  if (monster.boss || kills < DEX_MAX) {
    return { save: next, up: { monster, stage, fields: [], region: false } };
  }

  // 카드 하나가 끝 단계 — 그 몬스터가 나오는 사냥터들이 다 찼나 본다. 처치 수는 줄지 않아서 한 번만 넘는다
  const fields = regionById(monster.region).fields.filter(
    (f) => monstersOfField(f).some((m) => m.id === monster.id) && fieldDone(next, f),
  );
  const unspent = next.statPoints.unspent + fields.length * DEX.fieldPoints;
  return {
    save: { ...next, statPoints: { ...next.statPoints, unspent } },
    up: { monster, stage, fields, region: regionDone(next, monster.region) },
  };
}
