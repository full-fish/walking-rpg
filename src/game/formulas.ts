/**
 * 모든 수식과 상수는 이 파일에만 둔다. 다른 파일에 숫자를 박지 않는다.
 * React를 import하지 않는다 — Node에서 돌아야 한다.
 */

/** 지역이 하나 오를 때마다 10%씩 비싸진다 (§4.1). */
export function regionScaled(base: number, region: number): number {
  return Math.round(base * 1.1 ** (region - 1));
}

/** 최대 HP. T9에서 레벨·스탯 기반 계산으로 대체된다 — 그때까지 HUD 게이지의 분모. */
export const BASE_MAX_HP = 100;

/** 자정 기본 지급. 한 발도 안 걸은 날에도 이만큼은 준다 (§4.1). */
export const MIDNIGHT_WP = 1_000;

/** WP 소비처 6종 (§4.1). 지역에 따라 비싸지는 것은 함수, 고정인 것은 숫자. */
export const WP_COST = {
  /** 사냥터 입장 — 주 소비처. 몬스터 2~6마리 한 판 */
  fieldEntry: (region: number) => regionScaled(1_200, region),
  /** 보스 첫 도전 */
  bossFirst: (region: number) => regionScaled(10_000, region),
  /** 보스 재도전 */
  bossRetry: (region: number) => regionScaled(3_000, region),
  /** 다음 지역 해금 — region은 클리어한 지역 기준 */
  regionUnlock: (region: number) => regionScaled(10_000, region),
  /** 지역 간 이동. 같은 지역 안(마을↔사냥터)은 무료 */
  regionTravel: 1_000,
  /** 스탯 재분배. Lv10 이전은 호출부에서 면제 */
  statRespec: 3_000,
} as const;
