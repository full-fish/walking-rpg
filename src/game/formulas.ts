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

// ─────────────────────────────────────────────────────────────
// 성장 (§4.3)
// ─────────────────────────────────────────────────────────────

/** 직업별 레벨당 자동 성장. 배분 불가 (§4.3). */
export const JOB_GROWTH = {
  warrior: { maxHp: 14, atk: 2.0, def: 1.5, spd: 0.8 },
  rogue: { maxHp: 8, atk: 2.5, def: 0.8, spd: 1.6 },
  mage: { maxHp: 7, atk: 3.0, def: 0.6, spd: 1.0 },
} as const;

export type JobId = keyof typeof JOB_GROWTH;

/** 1차 스탯 1포인트당 효과 (§4.3). */
export const STAT_PER_POINT = {
  str: { atk: 2 },
  vit: { maxHp: 10, def: 0.5 },
  agi: { spd: 1.5, eva: 0.0015 },
  luk: { cri: 0.0025, dropRate: 0.002 },
} as const;

/** 레벨업마다 받는 수동 배분 포인트 (§4.3). */
export const POINTS_PER_LEVEL = 3;

/** 1차 스탯에 실제로 넣은 포인트 (§4.3). */
export type StatSpend = { str: number; vit: number; agi: number; luk: number };

/**
 * 레벨과 배분으로 전투 스탯을 만든다 (§4.3).
 * 배분을 안 주면 STR/VIT/AGI에 1점씩 균등하게 넣은 것으로 친다 — 밸런스 기준선이다.
 */
export function combatStats(level: number, job: JobId = 'warrior', spend?: StatSpend) {
  const ups = Math.max(0, level - 1);
  const growth = JOB_GROWTH[job];
  const s = spend ?? { str: ups, vit: ups, agi: ups, luk: 0 };
  return {
    maxHp: BASE_STATS.maxHp + growth.maxHp * ups + STAT_PER_POINT.vit.maxHp * s.vit,
    atk: BASE_STATS.atk + growth.atk * ups + STAT_PER_POINT.str.atk * s.str,
    def: BASE_STATS.def + growth.def * ups + STAT_PER_POINT.vit.def * s.vit,
    spd: BASE_STATS.spd + growth.spd * ups + STAT_PER_POINT.agi.spd * s.agi,
    cri: BASE_STATS.cri + STAT_PER_POINT.luk.cri * s.luk,
    crd: BASE_STATS.crd,
    eva: BASE_STATS.eva + STAT_PER_POINT.agi.eva * s.agi,
  };
}

// ─────────────────────────────────────────────────────────────
// 보상과 회복 (§4.2, §6.2, §6.3)
// ─────────────────────────────────────────────────────────────

/** 레벨 L에서 L+1로 가는 데 필요한 EXP (§6.2). */
export function expToNext(level: number): number {
  return Math.round(150 + 17.5 * level ** 1.35 * 1.016 ** level);
}

/** 몬스터 1마리의 기본 EXP (§6.2). tier는 지역 안에서의 티어 1~5. */
export function monsterExp(region: number, tierInRegion: number, power = 1): number {
  return 10 * 1.4 ** (region - 1) * (1 + 0.18 * tierInRegion) * power;
}

/** 몬스터 1마리의 기본 골드 (§6.3). */
export function monsterGold(region: number, tierInRegion: number, power = 1): number {
  return 38 * region * 1.1 ** (region - 1) * (1 + 0.15 * tierInRegion) * power;
}

/**
 * 개별 몬스터 보상에 곱하는 계수 (§4.4, §6.5).
 * 나머지는 클리어 보너스로 간다 — 둘을 합쳐야 v4의 하루 총량과 맞는다. 보너스는 T16.
 */
export const INDIVIDUAL_REWARD_RATE = 0.54;

/** HP 자연회복 — 10분당 최대 HP의 1% (§4.2). 앱이 꺼져 있어도 적용된다. */
export const HP_REGEN_RATE = 0.01;
export const HP_REGEN_INTERVAL_MS = 10 * 60 * 1000;
/** 시계 조작 방어 — 한 번 계산에 인정하는 최대 경과 시간 (§4.2). */
export const HP_REGEN_MAX_ELAPSED_MS = 24 * 60 * 60 * 1000;

/** 사망 시 소지 골드 상실률. 창고 골드는 면제 (§4.2). */
export const DEATH_GOLD_LOSS = 0.1;
/** 사망 후 부활 HP 비율 (§4.2). */
export const DEATH_HP_RATIO = 0.1;

// ─────────────────────────────────────────────────────────────
// 콘텐츠 (§7.2)
// ─────────────────────────────────────────────────────────────

/** 티어는 전역 1~25. 지역 5개가 5티어씩 나눠 갖는다 (§7.2①). */
export const REGION_COUNT = 5;
export const TIERS_PER_REGION = 5;
export const MAX_TIER = REGION_COUNT * TIERS_PER_REGION;
