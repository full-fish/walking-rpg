/**
 * 모든 수식과 상수는 이 파일에만 둔다. 다른 파일에 숫자를 박지 않는다.
 * React를 import하지 않는다 — Node에서 돌아야 한다.
 */

/** 값을 [min, max] 안으로 자른다. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 지역이 하나 오를 때마다 10%씩 비싸진다 (§4.1). */
export function regionScaled(base: number, region: number): number {
  return Math.round(base * 1.1 ** (region - 1));
}

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

// ─────────────────────────────────────────────────────────────
// 전투 (§4.2)
// ─────────────────────────────────────────────────────────────

/** Lv1 기본 스탯 (§4.3). T9의 레벨·스탯 성장이 여기서 출발한다. */
export const BASE_STATS = {
  maxHp: 100,
  atk: 10,
  def: 5,
  spd: 10,
  /** 크리 확률 */
  cri: 0.05,
  /** 크리 배율 */
  crd: 1.5,
  /** 회피 확률 */
  eva: 0.03,
} as const;

/** 대미지 감소 상수. DEF가 이 값과 같으면 피해가 정확히 절반이 된다 (§4.2). */
export const DAMAGE_K = 50;

/** 기본 대미지에 곱하는 난수 폭 (§4.2). */
export const DAMAGE_ROLL_MIN = 0.8;
export const DAMAGE_ROLL_MAX = 1.2;

/** ATB 행동 비율 상·하한. 민첩 몰빵도 2배가 한계 (§4.2). */
export const SPD_RATIO_MIN = 0.5;
export const SPD_RATIO_MAX = 2.0;

/**
 * 무한루프 방지용 행동 하드캡. 게임 규칙이 아니라 안전장치다 (§3.5).
 * 정상 플레이 최장이 64행동이라 걸리면 밸런스가 깨졌다는 신호다.
 */
export const HARDCAP_ACTIONS = 500;

/** 피해배율 — DEF가 높을수록 덜 아프다 (§4.2). */
export function damageMultiplier(def: number): number {
  return DAMAGE_K / (DAMAGE_K + def);
}

/** 플레이어가 몬스터보다 몇 배 자주 행동하는가. SPD 비율이 곧 행동 횟수 비율 (§4.2). */
export function actionRatio(playerSpd: number, monsterSpd: number): number {
  return clamp(playerSpd / monsterSpd, SPD_RATIO_MIN, SPD_RATIO_MAX);
}
