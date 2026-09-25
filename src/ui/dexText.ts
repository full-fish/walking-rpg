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

export const STAT_LABEL: Record<SpendableStat, string> = {
  str: '힘',
  vit: '체력',
  agi: '민첩',
  luk: '행운',
};
