/**
 * 도감 문구 (T19). 도감 칸·전투 결과·balance.md가 같이 쓴다 — 화면마다 적으면 갈라진다.
 * React를 import하지 않는다 — 도구(balance)도 읽는다.
 */
import { DEX, type SpendableStat } from '@/game/formulas';

/** 단계마다 열리는 것 (T19 검수 주석) — 1 · 10 · 25 · 50 · 100마리 */
export const DEX_REVEAL = [
  '이름 · 그림',
  `원형 · 티어 · 나오는 사냥터 · 장비 드랍 ×${DEX.dropMult}`,
  'EXP · 골드',
  '드랍 부위',
  `스탯 · 1차 스탯 +${DEX.cardStat}`,
];

/** 보스 카드 2 · 3 · 4 · 5번의 보상 (T19 검수 3차) — 도감 칸 · balance.md가 같이 쓴다. 보스마다 따로 더한다 */
export const BOSS_REWARDS = [
  `그 지역 장비 드랍 ×${DEX.bossDropMult}`,
  `EXP · 골드 +${pct(DEX.bossExpGold)}`,
  `네 스탯 +${DEX.bossStat}`,
  `강화 성공률 +${pct(DEX.bossEnhance)}p · 그 지역 전설 ×${DEX.bossLegendMult}`,
];

/** 보스는 잡을 때마다 한 단계 (T19 검수: 재사냥) — 나오는 사냥터가 없는 대신 단계마다 위 보상이 붙는다 */
export const BOSS_REVEAL = [
  '이름 · 그림',
  `원형 · 티어 · ${BOSS_REWARDS[0]}`,
  `EXP · 골드 · 받는 ${BOSS_REWARDS[1]}`,
  `첫 처치 보상 · ${BOSS_REWARDS[2]}`,
  `스탯 · ${BOSS_REWARDS[3]}`,
];

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export const STAT_LABEL: Record<SpendableStat, string> = {
  str: '힘',
  vit: '체력',
  agi: '민첩',
  luk: '행운',
};
