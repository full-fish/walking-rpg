/**
 * 반지 이름과 효과 문구 (T17_7). 상점·캐릭터 탭이 같이 쓴다 — 화면마다 적으면 갈라진다.
 * 값은 formulas의 ringValue가 정하고, 여기서는 읽는 말로만 바꾼다.
 */
import { BOSS_BUFF, type GridRarity, type RingKind } from '@/game/formulas';
import { ringEffect } from '@/game/items';
import type { Ring } from '@/save/schema';

/** 0.034 → "3.4%" */
const pct = (v: number) => `${+(v * 100).toFixed(1)}%`;

export const RING_INFO: Record<RingKind, { name: string; effect: (v: number) => string }> = {
  fieldWp: { name: '나그네의 반지', effect: (v) => `사냥터 입장 WP −${pct(v)}` },
  midnightWp: { name: '새벽의 반지', effect: (v) => `자정 WP +${Math.round(v)}` },
  bigRun: { name: '사냥꾼의 반지', effect: (v) => `6마리 판 확률 +${pct(v)}p` },
  clearBonus: { name: '정복자의 반지', effect: (v) => `클리어 보너스 +${pct(v)}` },
  exp: { name: '현자의 반지', effect: (v) => `EXP +${pct(v)}` },
  gold: { name: '상인의 반지', effect: (v) => `골드 +${pct(v)}` },
  drop: { name: '도굴꾼의 반지', effect: (v) => `장비 드랍 +${pct(v)}` },
  potion: { name: '약초꾼의 반지', effect: (v) => `물약 회복 +${pct(v)}` },
  shield: { name: '수호자의 반지', effect: (v) => `전투 시작 보호막 — 최대 HP의 ${pct(v)}` },
  bossBuff: {
    name: '결의의 반지',
    effect: (v) => `보스 버프 하나가 ×${BOSS_BUFF.mult} → ×${(BOSS_BUFF.mult + v).toFixed(3)}`,
  },
  bossDamage: { name: '용사의 반지', effect: (v) => `보스에게 주는 피해 +${pct(v)}` },
};

/** 반지 등급 이름. 장비는 색으로만 보여주지만 반지는 "다음 등급"을 말로 적어야 해서 둔다 */
export const RARITY_LABEL: Record<GridRarity, string> = {
  common: '일반',
  uncommon: '고급',
  rare: '희귀',
  epic: '영웅',
  legendary: '전설',
};

/** "상인의 반지 ★2 +3" — ★는 소재를 받는 지역, 색이 등급이다 */
export function ringName(ring: Ring): string {
  const enhance = ring.enhance > 0 ? ` +${ring.enhance}` : '';
  return `${RING_INFO[ring.kind].name} ★${ring.tier}${enhance}`;
}

/** 그 반지 하나의 효과 한 줄 */
export function ringText(ring: Ring): string {
  return RING_INFO[ring.kind].effect(ringEffect(ring));
}
