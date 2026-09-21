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

/**
 * 시작 1차 스탯 (§4.3). RPG에서 스탯이 0부터 시작하는 건 없으니 4~6에서 출발한다.
 * 직업마다 배분이 다르지만 **총합은 19로 같다** — 어느 직업도 그냥 세지 않는다.
 */
export const STARTING_STATS: Record<JobId, StatSpend> = {
  warrior: { str: 5, vit: 6, agi: 4, luk: 4 },
  rogue: { str: 5, vit: 4, agi: 6, luk: 4 },
  mage: { str: 6, vit: 4, agi: 4, luk: 5 },
};

/**
 * 1차 스탯을 뺀 나머지 기본값 (§4.3).
 *
 * §4.3 표의 "Lv1 기본값 maxHP 100 / ATK 10 / DEF 5 / SPD 10"은 **전사 기준 합계**다.
 * 전사의 시작 스탯(STR5 VIT6 AGI4 LUK4)이 주는 몫을 빼면 아래가 남는다 —
 * 그래서 전사 Lv1은 예나 지금이나 정확히 100/10/5/10이고 T7 이후 밸런스가 안 흔들린다.
 */
export const BASE_STATS = {
  maxHp: 40,
  atk: 0,
  def: 2,
  spd: 4,
  /** 크리 확률 */
  cri: 0.04,
  /** 크리 배율 */
  crd: 1.5,
  /** 회피 확률 */
  eva: 0.024,
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

/**
 * 피해배율 — DEF가 높을수록 덜 아프다 (§4.2).
 *
 * `scale`은 맞는 쪽이 여태 받은 성장 배수다(Lv1 플레이어·티어0 몬스터가 1.0).
 * DEF는 레벨·티어를 따라 커지는데 K가 50으로 고정이면 감소율이 계속 올라간다 —
 * T12 시뮬레이터에서 Lv50 플레이어가 피해를 93% 깎아 후반이 통째로 거저가 됐다.
 * K를 같은 배수로 키우면 DEF/K 비가 유지돼서 감소율이 레벨과 무관해진다.
 */
export function damageMultiplier(def: number, scale = 1): number {
  const k = DAMAGE_K * scale;
  return k / (k + def);
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
 * 레벨이 하나 오를 때 전투 스탯 전체에 곱해지는 값 (§4.3).
 *
 * 포인트·직업 성장만으로는 스탯이 레벨에 **선형**으로 는다. 그런데 몬스터는 티어당
 * 지수로 자라서(§7.2④) 뒤로 갈수록 격차가 벌어진다 — T11 벤치와 T12 시뮬레이터가
 * 둘 다 같은 결론을 냈다(Lv50에서 몬스터 HP가 플레이어의 9.1배, 어떤 빌드도 Lv50 미달).
 *
 * 1.04면 49레벨 동안 6.83배가 곱해져서 몬스터/플레이어 HP 비가
 * Lv1 1.32 → Lv50 1.33으로 거의 평평해진다. 성장 체감도 선형보다 지수에 가까워진다.
 */
export const LEVEL_GROWTH = 1.04;

/** 그 레벨의 전투 스탯 배수. Lv1은 1.0이다. */
export function levelMultiplier(level: number): number {
  return LEVEL_GROWTH ** Math.max(0, level - 1);
}

/**
 * 레벨과 배분으로 전투 스탯을 만든다 (§4.3).
 *
 * 1차 스탯 = 직업 시작값 + 배분한 포인트. 배분을 안 주면 STR/VIT/AGI에 균등하게
 * 넣은 것으로 친다 — 밸런스 기준선이다.
 * 거기서 나온 값 전체에 레벨 배수를 곱한다. 포인트 1점의 가치도 같이 커지므로
 * 뒤늦게 올린 스탯이 쓸모없어지지 않는다.
 */
export function combatStats(level: number, job: JobId = 'warrior', spend?: StatSpend) {
  const ups = Math.max(0, level - 1);
  const growth = JOB_GROWTH[job];
  const start = STARTING_STATS[job];
  const put = spend ?? { str: ups, vit: ups, agi: ups, luk: 0 };
  const s = {
    str: start.str + put.str,
    vit: start.vit + put.vit,
    agi: start.agi + put.agi,
    luk: start.luk + put.luk,
  };
  const m = levelMultiplier(level);
  return {
    maxHp: Math.round((BASE_STATS.maxHp + growth.maxHp * ups + STAT_PER_POINT.vit.maxHp * s.vit) * m),
    atk: (BASE_STATS.atk + growth.atk * ups + STAT_PER_POINT.str.atk * s.str) * m,
    def: (BASE_STATS.def + growth.def * ups + STAT_PER_POINT.vit.def * s.vit) * m,
    spd: (BASE_STATS.spd + growth.spd * ups + STAT_PER_POINT.agi.spd * s.agi) * m,
    // 확률은 배수를 곱하지 않는다 — 레벨만으로 크리 100%가 되면 안 된다
    cri: BASE_STATS.cri + STAT_PER_POINT.luk.cri * s.luk,
    crd: BASE_STATS.crd,
    eva: BASE_STATS.eva + STAT_PER_POINT.agi.eva * s.agi,
    scale: m,
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
/** 지역마다 사냥터 5개 (§4.4). */
export const FIELDS_PER_REGION = 5;

/**
 * 티어가 하나 오를 때 몬스터 스탯에 곱하는 값 (§7.2④).
 *
 * ★ 1.20은 초안이고 **T12 시뮬레이터가 확정한다.** 24티어 동안 79배가 되는데
 * 플레이어는 49레벨 동안 11.5배(HP)/18.1배(ATK)라 곡선이 어긋난다 — 맞추려면 1.11~1.13.
 * 여기 한 줄만 바꾸면 gen-content가 전부 다시 뽑는다.
 */
export const MONSTER_GROWTH = 1.2;
/**
 * HP만 조금 더 가파르게 오른다 (§7.2④).
 *
 * §4.3에서 플레이어 ATK는 49레벨 동안 124배가 되는데 HP는 78배다 — 공격이 방어보다
 * 빨리 큰다. 몬스터 HP를 같은 비율로 올려주지 않으면 뒤로 갈수록 전투가 짧아지고
 * (Lv1 14대 → Lv50 9대) 맞을 기회 자체가 줄어 후반이 통째로 안전해진다.
 */
export const MONSTER_HP_GROWTH = 1.223;
/** SPD만 따로 완만하게 오른다. 행동 횟수가 SPD 비율에 직접 비례하기 때문 (§4.2). */
export const MONSTER_SPD_GROWTH = 1.06;

/**
 * 티어 0 기준 몬스터 (§7.2④).
 *
 * T7이 벤치로 역산한 값이고, T11에서 실제 사냥터 풀로 다시 확인했다.
 * 사냥터마다 적정 레벨(그 풀의 평균 티어로 정해지는)에서 한 마리에 HP 10~20%를 깎는다 —
 * 한 판 평균 4마리(§4.4)가 빠듯하게 도는 값이다. 최종 확정은 T12 시뮬레이터가 한다.
 */
export const MONSTER_BASE = { hp: 110, atk: 5.0, def: 4.2, spd: 9.4 } as const;

export type StatBias = { hp: number; atk: number; def: number; spd: number };

/**
 * 몬스터 한 마리의 스탯 (§7.2④). 원형 × 티어 × 지역 난이도.
 *
 * SPD에만 power를 곱하지 않는다 — 행동 횟수가 SPD 비율에 직접 비례하므로(§4.2)
 * power까지 곱하면 센 원형이 2배 상한에 쉽게 닿는다.
 */
export function monsterStats(tier: number, difficulty: number, power: number, bias: StatBias) {
  const scale = MONSTER_GROWTH ** tier * difficulty * power;
  return {
    maxHp: Math.round(MONSTER_BASE.hp * MONSTER_HP_GROWTH ** tier * difficulty * power * bias.hp),
    atk: round2(MONSTER_BASE.atk * scale * bias.atk),
    def: round2(MONSTER_BASE.def * scale * bias.def),
    spd: round2(MONSTER_BASE.spd * MONSTER_SPD_GROWTH ** tier * bias.spd),
    scale: round2(MONSTER_GROWTH ** tier * difficulty),
  };
}

/** 생성물 JSON에 끝없는 소수가 들어가지 않게 자른다. */
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ─────────────────────────────────────────────────────────────
// 사냥터 한 판 (§4.4) — 진행 로직은 T16 field.ts
// ─────────────────────────────────────────────────────────────

/** 한 판의 마릿수 분포. 평균 4.0인 삼각분포 (§4.4). 남은 수는 UI에 절대 노출하지 않는다. */
export const RUN_SIZE_WEIGHTS = [
  [2, 0.1],
  [3, 0.2],
  [4, 0.4],
  [5, 0.2],
  [6, 0.1],
] as const;

/** 클리어 보너스 = 그 판 개별 보상 합 × 0.2 × 마릿수 (§4.4). */
export const CLEAR_BONUS_RATE = 0.2;

/** 한 판의 마릿수를 뽑는다. 입장 시점에 정해지고 끝까지 안 보여준다 (§4.4). */
export function rollRunSize(rng: () => number): number {
  let r = rng();
  for (const [size, weight] of RUN_SIZE_WEIGHTS) {
    r -= weight;
    if (r < 0) return size;
  }
  return RUN_SIZE_WEIGHTS.at(-1)![0];
}
