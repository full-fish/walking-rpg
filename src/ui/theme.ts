/** 픽셀 테마 토큰. 색/폰트/간격은 전부 여기서만 바꾼다. */
export const colors = {
  bg: '#1A1626',
  panel: '#2A2438',
  edge: '#4A3F63',
  edgeLit: '#6B5C8C',
  text: '#F2E9DC',
  dim: '#8C7FA6',
  gold: '#E8B44A',
  hp: '#C8443C',
  wp: '#54B47A',
  exp: '#4A8FD4',
} as const;

/** 등급 테두리 색 (§4.5). 키는 formulas.ts의 RARITIES와 같다. 흔한 것일수록 어둡다 */
export const rarity = {
  common: '#8C7FA6',
  uncommon: '#54B47A',
  rare: '#4A8FD4',
  epic: '#A15CD0',
  legendary: '#E8B44A',
} as const;

/**
 * 치명타 X자 색 (T17_7 검수 5차) — 치명 배율이 클수록 붉어진다. 2배 미만은 금색 그대로.
 * 높은 문턱부터 적는다 — 처음 넘는 것이 그 색이다.
 */
const CRIT_TIERS = [
  [3, '#FF0084'],
  [2.5, '#BE3904'],
  [2, '#BE8304'],
] as const;

export function critColor(crd: number): string {
  return CRIT_TIERS.find(([min]) => crd >= min)?.[1] ?? colors.gold;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const font = {
  family: 'Galmuri11',
  sm: 12,
  md: 14,
  lg: 18,
  xl: 24,
} as const;

/** 픽셀 테두리 두께. 라운드는 쓰지 않는다(도트 느낌 유지). */
export const border = 2;
