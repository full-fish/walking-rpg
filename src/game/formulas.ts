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
 *
 * **전투 4종(STR·VIT·AGI·LUK)의 합은 19로 같다** — 어느 직업도 그냥 세지 않는다.
 * INT는 그 위에 얹는다. 지금은 MP와 마법 공격력만 올리고 전투에는 안 쓰이므로(스킬이 T18)
 * 직업마다 달라도 밸런스가 안 움직인다. 마법사만 8로 두어 정체성을 미리 박아둔다.
 */
export const STARTING_STATS: Record<JobId, StatSpend> = {
  warrior: { str: 5, vit: 6, agi: 4, luk: 4, int: 4 },
  rogue: { str: 5, vit: 4, agi: 6, luk: 4, int: 4 },
  mage: { str: 6, vit: 4, agi: 4, luk: 5, int: 8 },
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
  /** 마나. INT를 뺀 나머지 — 전사 Lv1이 60, 마법사가 100이 되는 값 */
  maxMp: 20,
  atk: 0,
  /** 마법 공격력. 스킬이 생기면(T18) 여기서 출발한다 */
  matk: 0,
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
 * `scale`은 맞는 쪽이 **그 단계에서 갖고 있을 것으로 기대되는 전투력 배수**다.
 * 플레이어는 powerScale(레벨), 몬스터는 티어 성장 배수이고, Lv1·티어0이 1.0이다.
 * DEF는 진행에 따라 커지는데 K가 50으로 고정이면 감소율이 계속 올라간다 —
 * T12 시뮬레이터에서 Lv50 플레이어가 피해를 93% 깎아 후반이 통째로 거저가 됐다.
 * K를 같은 배수로 키우면 DEF/K 비가 유지돼서 감소율이 진행도와 무관해진다.
 * 기대치보다 좋은 장비를 낀 만큼만 감소율이 올라간다 — 그게 장비를 맞추는 이유다.
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
  warrior: { maxHp: 14, maxMp: 2, atk: 2.0, matk: 0.2, def: 1.5, spd: 0.8 },
  rogue: { maxHp: 8, maxMp: 3, atk: 2.5, matk: 0.5, def: 0.8, spd: 1.6 },
  mage: { maxHp: 7, maxMp: 8, atk: 3.0, matk: 3.0, def: 0.6, spd: 1.0 },
} as const;

export type JobId = keyof typeof JOB_GROWTH;

/** 1차 스탯 1포인트당 효과 (§4.3). */
export const STAT_PER_POINT = {
  str: { atk: 2 },
  vit: { maxHp: 10, def: 0.5 },
  agi: { spd: 1.5, eva: 0.0015 },
  luk: { cri: 0.0025, dropRate: 0.002 },
  /** 마법사용. 쓸 데가 생기는 건 스킬이 들어오는 T18이라 아직 배분 대상이 아니다 */
  int: { maxMp: 10, matk: 2 },
} as const;

/** 레벨업마다 받는 수동 배분 포인트 (§4.3). */
export const POINTS_PER_LEVEL = 3;

/** 1차 스탯에 실제로 넣은 포인트 (§4.3). */
export type StatSpend = {
  str: number;
  vit: number;
  agi: number;
  luk: number;
  /** T18까지는 항상 0 — 직업 시작값으로만 들어온다 (§4.3) */
  int: number;
};

/** 레벨업 포인트를 실제로 넣을 수 있는 스탯 (§4.3). INT는 T18에 합류한다. */
export const SPENDABLE_STATS = ['str', 'vit', 'agi', 'luk'] as const;
export type SpendableStat = (typeof SPENDABLE_STATS)[number];

/**
 * 진행 단계별 기대 전투력 배수 (§4.3, §4.5).
 *
 * 맨몸 스탯은 레벨에 **선형**으로 는다 — STR 1점이 언제나 딱 ATK +2다. 그런데 몬스터는
 * 티어당 지수로 자라서(§7.2④) 그대로 두면 Lv50에서 몬스터가 9.1배 세진다.
 * **그 차이를 장비가 댄다.** Lv50에서 6.83배 중 5.83배가 장비 몫이니 전투력의 85%다.
 *
 * T12는 이 배수를 스탯에 직접 곱했었다(LEVEL_GROWTH). 밸런스는 맞았지만 "STR +1 = ATK +2"가
 * 실제로는 +13.7이 되어 숫자가 거짓말을 했다. 지금은 **스탯에 곱하지 않는다.**
 * 이 값이 쓰이는 곳은 둘뿐이다 —
 *   ① gearShare()   그 단계 장비가 채워야 할 몫
 *   ② damageMultiplier()의 K 기준선 (그 단계의 기대 DEF 크기)
 */
export const POWER_GROWTH = 1.04;

/** 그 레벨의 기대 전투력 배수. Lv1은 1.0이다. */
export function powerScale(level: number): number {
  return POWER_GROWTH ** Math.max(0, level - 1);
}

/**
 * 그 레벨에서 **장비가 채워야 하는 몫** (§4.5). 맨몸 대비 몇 배를 더 얹느냐다.
 * Lv1은 0 (맨몸이 기준), Lv50은 5.83 (장비가 전투력의 85%).
 */
export function gearShare(level: number): number {
  return powerScale(level) - 1;
}

/**
 * 레벨과 배분으로 **맨몸** 전투 스탯을 만든다 (§4.3). 장비는 statsOf()가 더한다.
 *
 * 1차 스탯 = 직업 시작값 + 배분한 포인트. 배분을 안 주면 STR/VIT/AGI에 균등하게
 * 넣은 것으로 친다 — 밸런스 기준선이다.
 * 여기서 나오는 값은 전부 표에 적힌 그대로다. 숨은 배수는 없다.
 */
export function combatStats(level: number, job: JobId = 'warrior', spend?: StatSpend) {
  const ups = Math.max(0, level - 1);
  const growth = JOB_GROWTH[job];
  const start = STARTING_STATS[job];
  const put = spend ?? { str: ups, vit: ups, agi: ups, luk: 0, int: 0 };
  const s = {
    str: start.str + put.str,
    vit: start.vit + put.vit,
    agi: start.agi + put.agi,
    luk: start.luk + put.luk,
    int: start.int + put.int,
  };
  return {
    maxHp: Math.round(BASE_STATS.maxHp + growth.maxHp * ups + STAT_PER_POINT.vit.maxHp * s.vit),
    /** 스킬 자원. 쓰는 곳은 T18 */
    maxMp: Math.round(BASE_STATS.maxMp + growth.maxMp * ups + STAT_PER_POINT.int.maxMp * s.int),
    atk: BASE_STATS.atk + growth.atk * ups + STAT_PER_POINT.str.atk * s.str,
    /** 마법 공격력. 평타는 아직 ATK만 쓴다 — 마법 평타·스킬은 T18 */
    matk: BASE_STATS.matk + growth.matk * ups + STAT_PER_POINT.int.matk * s.int,
    def: BASE_STATS.def + growth.def * ups + STAT_PER_POINT.vit.def * s.vit,
    spd: BASE_STATS.spd + growth.spd * ups + STAT_PER_POINT.agi.spd * s.agi,
    cri: BASE_STATS.cri + STAT_PER_POINT.luk.cri * s.luk,
    crd: BASE_STATS.crd,
    eva: BASE_STATS.eva + STAT_PER_POINT.agi.eva * s.agi,
    /** 피해배율 K의 기준선 — 스탯에 곱하는 값이 아니다 (§4.2) */
    scale: powerScale(level),
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

// ─────────────────────────────────────────────────────────────
// 장비 (§4.5) — 전투력의 85%가 여기서 나온다
// ─────────────────────────────────────────────────────────────

/** 부위 6종 (§4.5). */
export const GEAR_SLOTS = ['weapon', 'helm', 'armor', 'gloves', 'boots', 'accessory'] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];

/** 장비 티어 10단계 — 지역마다 2단계씩 (§7.2). 몬스터 티어(1~25)와는 다른 축이다. */
export const GEAR_TIERS = 10;
export const GEAR_TIERS_PER_REGION = GEAR_TIERS / REGION_COUNT;

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

/**
 * 등급 배율 (§4.5). common이 밸런스 기준선이다 —
 * 시뮬레이터도 검증도 "그 지역 common 풀세트"로 잰다. 위 등급은 전부 초과 이득이다.
 */
export const RARITY_MULT: Record<Rarity, number> = {
  common: 1.0,
  uncommon: 1.15,
  rare: 1.35,
  epic: 1.6,
  legendary: 1.9,
};

/** 등급별 가격 배율. 위 등급은 드랍으로 먹는 것이지 사는 게 아니라 가파르다. */
export const RARITY_PRICE: Record<Rarity, number> = {
  common: 1,
  uncommon: 2.2,
  rare: 5,
  epic: 12,
  legendary: 30,
};

/**
 * 부위가 가져가는 몫 (§4.5). **스탯마다 합이 1.0**이라 6부위 풀세트가 곧 그 티어의 몫이다.
 * 무기는 ATK, 갑옷·투구는 HP/DEF — 부위마다 성격이 다르게만 나눠 갖는다.
 */
export const SLOT_BIAS: Record<GearSlot, { atk: number; maxHp: number; def: number }> = {
  weapon: { atk: 0.55, maxHp: 0.05, def: 0.05 },
  helm: { atk: 0.05, maxHp: 0.2, def: 0.2 },
  armor: { atk: 0.05, maxHp: 0.35, def: 0.35 },
  gloves: { atk: 0.15, maxHp: 0.1, def: 0.15 },
  boots: { atk: 0.05, maxHp: 0.15, def: 0.15 },
  accessory: { atk: 0.15, maxHp: 0.15, def: 0.1 },
};

/** 부위별 가격 몫. 합이 6.0이라 "풀세트 = 세트 가격"이 그대로 성립한다. */
export const SLOT_PRICE: Record<GearSlot, number> = {
  weapon: 1.5,
  helm: 0.9,
  armor: 1.2,
  gloves: 0.8,
  boots: 0.8,
  accessory: 0.8,
};

/** 품질 범위 (§4.5). 삼각분포라 1.0 근처가 흔하고 양 끝이 드물다. */
export const QUALITY_MIN = 0.8;
export const QUALITY_MAX = 1.2;

/** 인벤토리 상한. 차면 드랍만 건너뛰고 사냥은 계속된다 (§4.5). */
export const INVENTORY_MAX = 60;

/** 강화 (§4.5). 최종 스탯 = 기본 × quality × 1.1^강화. 실제 강화 로직은 T15. */
export const ENHANCE_MAX = 10;
export const ENHANCE_MULT = 1.1;

/** 품질을 뽑는다. 난수 둘의 평균이 삼각분포가 된다 — 표를 따로 들 필요가 없다 (§4.5). */
export function rollQuality(rng: () => number): number {
  const t = (rng() + rng()) / 2;
  return Math.round((QUALITY_MIN + (QUALITY_MAX - QUALITY_MIN) * t) * 100) / 100;
}

/** 인스턴스 하나의 최종 스탯 (§4.5). 기본 × 품질 × 1.1^강화. */
export function itemStat(base: number, quality: number, enhance: number): number {
  return base * quality * ENHANCE_MULT ** enhance;
}

/**
 * 장비 한 점의 기본 스탯 (§4.5).
 *
 * 기준은 **그 레벨의 맨몸 스탯**이다. gearShare(level)만큼을 6부위가 나눠 가지므로
 * common 풀세트를 갖춰 입으면 전투력이 정확히 powerScale(level)배가 된다.
 * SPD·크리·회피는 안 준다 — 행동 횟수는 이미 2배 상한에 눌려 있고(§4.2) 그건 AGI 몫이다.
 */
export function gearStats(level: number, slot: GearSlot, rarity: Rarity) {
  const naked = combatStats(level);
  const share = gearShare(level) * RARITY_MULT[rarity];
  const bias = SLOT_BIAS[slot];
  return {
    atk: Math.round(naked.atk * share * bias.atk),
    maxHp: Math.round(naked.maxHp * share * bias.maxHp),
    def: Math.round(naked.def * share * bias.def),
  };
}

/**
 * 지역별 하루 골드 수입 (§6.3). 장비 가격을 여기에 묶어 둔다 —
 * §4.5의 "common 6부위 풀세트 ≈ 그 지역 하루 수입 1일치"가 계수가 아니라 정의가 된다.
 */
export const REGION_DAILY_GOLD = [2_020, 4_041, 6_061, 8_081, 10_102] as const;

/** 장비 티어가 속한 지역 (§7.2). 티어 1~2가 지역 1이다. */
export function regionOfGearTier(gearTier: number): number {
  return Math.ceil(gearTier / GEAR_TIERS_PER_REGION);
}

/** 그 티어 common 풀세트의 값 (§4.5). 지역 앞단은 0.8일치, 뒷단은 1.2일치. */
export function gearSetPrice(gearTier: number): number {
  const region = regionOfGearTier(gearTier);
  const day = REGION_DAILY_GOLD[region - 1];
  return day * (gearTier % 2 === 1 ? 0.8 : 1.2);
}

/** 장비 한 점의 값. 풀세트를 다 더하면 gearSetPrice가 된다 (SLOT_PRICE 합이 6). */
export function gearPrice(gearTier: number, slot: GearSlot, rarity: Rarity): number {
  return Math.round((gearSetPrice(gearTier) / 6) * SLOT_PRICE[slot] * RARITY_PRICE[rarity]);
}
