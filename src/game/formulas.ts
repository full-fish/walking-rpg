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
export const DAMAGE_ROLL_MIN = 0.6;
export const DAMAGE_ROLL_MAX = 1.4;

/**
 * ATB 행동 비율 상·하한 (§4.2).
 *
 * 2.0이었는데 3.0으로 올렸다. 이유는 "민첩 몰빵에 여유를 주려고"가 아니라 **상한이 기본값이었기
 * 때문**이다 — 플레이어 SPD는 레벨당 선형(+2.3)인데 몬스터는 티어당 1.06배라, Lv8부터는
 * 민첩을 한 점도 안 찍어도 비율이 2를 넘었다(Lv50에 3.04). AGI의 SPD가 죽은 스탯이었다.
 * MONSTER_SPD_GROWTH를 같이 올려서 균등 배분이 0.96~1.67에 머물게 했고,
 * 그래서 이제 이 상한은 **민첩을 실제로 찍은 사람만 닿는다.**
 */
export const SPD_RATIO_MIN = 0.5;
export const SPD_RATIO_MAX = 3.0;

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

/**
 * 직업별 레벨당 자동 성장. 배분 불가 (§4.3).
 *
 * spd가 0.8/1.6/1.0에서 2.6/3.4/2.8로 올랐다(+1.8). **빌드 간 SPD 격차를 좁히려는 것**이다 —
 * 전에는 Lv50에서 민첩 0점(49)과 몰빵(270)이 5.5배 차이라 행동 비율 창 [0.5, 3.0] 안에
 * 도저히 안 들어갔고, 몬스터를 어디에 맞춰도 한쪽이 바닥이나 상한에 붙었다.
 * 자동 성장을 올리면 격차가 2.6배로 줄어 셋 다 창 안에 들어온다.
 * AGI 1점의 값(+1.5)은 그대로다 — 비중만 38%로 일정해진다.
 */
export const JOB_GROWTH = {
  warrior: { maxHp: 14, maxMp: 2, atk: 2.0, matk: 0.2, def: 1.5, spd: 2.6 },
  rogue: { maxHp: 8, maxMp: 3, atk: 2.5, matk: 0.5, def: 0.8, spd: 3.4 },
  mage: { maxHp: 7, maxMp: 8, atk: 3.0, matk: 3.0, def: 0.6, spd: 2.8 },
} as const;

export type JobId = keyof typeof JOB_GROWTH;

/** 1차 스탯 1포인트당 효과 (§4.3). */
export const STAT_PER_POINT = {
  str: { atk: 2 },
  vit: { maxHp: 10, def: 0.5 },
  agi: { spd: 1.5, eva: 0.0015 },
  /**
   * 치명 확률만으로는 너무 얇아서 몰빵이 Lv50에 못 갔다 (T13 시뮬 400일 미달).
   * 확률과 배율을 같이 올리고 골드·드랍까지 준다 — 기댓값을 증폭하는 스탯이라는 성격 그대로,
   * 대신 실제로 증폭되게 한다.
   *
   * **넷 다 가산이다** (T17_4). 드랍·골드는 1점당 **+2%** 라(T17_6에서 1% → 2%)
   * 151점(Lv50 몰빵)이면 ×4.02다. T17에서 곱산(1점당 ×1.01)으로 했다가 되돌렸다 —
   * 후반에 급격히 붙어서 행운 1점의 값이 "지금 몇 점이냐"에 따라 달라졌다.
   * dropRate는 **몬스터 장비 드랍에만** 곱한다 (DROP_RATE, T17_6). 사냥터 소재는
   * 6마리 완주 확정이라 확률이 끼어들 자리가 없다 (§4.4).
   */
  luk: { cri: 0.0025, crd: 0.005, dropRate: 0.02, goldFind: 0.02 },
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
 * 티어와 상관없이 장비가 기본으로 얹어주는 몫 (§4.5).
 *
 * 없을 때는 Lv1 장비가 ATK +1이었다 — **힘 1포인트(+2)보다 약한 무기**다.
 * 강화를 해도 1.1배가 반올림에 먹혀 화면이 안 움직였다.
 * 0.5면 Lv1 풀세트가 맨몸의 절반을 얹어주고(전투력의 33%), 티어 1 무기가 ATK +5가 된다.
 * 뒤로 갈수록 gearShare가 커지므로 이 값의 비중은 저절로 줄어든다 — Lv50에서는 8%다.
 */
export const GEAR_FLOOR = 0.5;

/**
 * 그 레벨에서 **장비가 채워야 하는 몫** (§4.5). 맨몸 대비 몇 배를 더 얹느냐다.
 * Lv1은 0.5(전투력의 33%), Lv50은 6.33(86%).
 */
export function gearShare(level: number): number {
  return powerScale(level) - 1 + GEAR_FLOOR;
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
    crd: BASE_STATS.crd + STAT_PER_POINT.luk.crd * s.luk,
    eva: BASE_STATS.eva + STAT_PER_POINT.agi.eva * s.agi,
    /** 장비 드랍 배율 (T19). 소재에는 안 붙는다 — 6마리 완주 확정이다 (§4.4) */
    dropMult: 1 + STAT_PER_POINT.luk.dropRate * s.luk,
    /** 골드 배율. killReward가 골드에만 곱한다 (EXP는 안 건드린다) */
    goldMult: 1 + STAT_PER_POINT.luk.goldFind * s.luk,
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
/**
 * 지역마다 사냥터 7개 (§4.4, T17_4). **부위 수와 같다** — 사냥터마다 고유 장비 한 부위씩이라
 * 한 지역을 다 돌면 7부위가 한 벌이 된다.
 */
export const FIELDS_PER_REGION = 7;

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
/**
 * SPD만 **선형**으로 오른다 — 티어당 +7.2 (§4.2, §7.2④).
 *
 * 다른 스탯이 지수인 건 플레이어의 HP/ATK/DEF가 장비를 끼고 지수로 자라기 때문이다(§4.5).
 * 그런데 **SPD는 장비가 배수로 밀어주지 않아 레벨에 선형으로만 자란다.** 여기에 지수를 맞추면
 * 어디선가 반드시 어긋난다 — 1.06이면 Lv8부터 플레이어가 상한(2배)에 붙어 AGI가 죽고,
 * 1.11~1.13으로 올리면 중반에 플레이어가 앞질러 적정 레벨 완주율이 100%로 굳었다.
 * 선형으로 두면 **Lv1부터 Lv50까지 비율이 1.08~1.30으로 평평하다.**
 *   민첩 0점 0.73~1.30 · 균등 1.08~1.30 · 민첩 몰빵 1.78~2.26
 * 셋 다 [0.5, 3.0] 창 안이고, 상한은 몰빵 + 좋은 신발 + 느린 원형이 겹쳐야 닿는다.
 */
export const MONSTER_SPD_PER_TIER = 7.2;

/**
 * 티어 0 기준 몬스터 (§7.2④).
 *
 * T7이 벤치로 역산한 값이고, T11에서 실제 사냥터 풀로 다시 확인했다.
 * 사냥터마다 적정 레벨(그 풀의 평균 티어로 정해지는)에서 한 마리에 HP 10~20%를 깎는다 —
 * 한 판 평균 4마리(§4.4)가 빠듯하게 도는 값이다. 최종 확정은 T12 시뮬레이터가 한다.
 */
export const MONSTER_BASE = { hp: 110, atk: 3.4, def: 4.2, spd: 2.0 } as const;

export type StatBias = { hp: number; atk: number; def: number; spd: number };

/**
 * 몬스터 한 마리의 스탯 (§7.2④). 원형 × 티어 × 지역 난이도.
 *
 * SPD에만 power를 곱하지 않는다 — 행동 횟수가 SPD 비율에 직접 비례하므로(§4.2)
 * power까지 곱하면 센 원형이 2배 상한에 쉽게 닿는다.
 */
export function monsterStats(tier: number, difficulty: number, power: number, bias: StatBias) {
  const common = difficulty * power;
  return {
    maxHp: Math.round(MONSTER_BASE.hp * MONSTER_HP_GROWTH ** tier * common * bias.hp),
    atk: round2(MONSTER_BASE.atk * MONSTER_GROWTH ** tier * common * bias.atk),
    def: round2(MONSTER_BASE.def * MONSTER_GROWTH ** tier * common * bias.def),
    spd: round2((MONSTER_BASE.spd + MONSTER_SPD_PER_TIER * tier) * bias.spd),
    scale: round2(MONSTER_GROWTH ** tier * difficulty),
  };
}

/** 생성물 JSON에 끝없는 소수가 들어가지 않게 자른다. */
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
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

/**
 * 사냥터에 들고 들어갈 수 있는 물약 수 (§4.4). 엘릭서도 이 칸에 포함된다.
 * 물약 하나가 maxHP의 30~40%를 회복하고 전투 1회에 약 20%를 깎이므로,
 * 6마리 판(소모 ~120%)을 완주하려면 3개가 거의 딱 맞는다.
 */
export const POTION_CARRY_MAX = 3;

/**
 * 소재가 떨어지는 마릿수 (§4.4). **이 미만은 아예 안 나온다** — 확률이 아니라 0이다.
 * 마릿수 뽑기 자체가 이미 도박이라(10%가 6마리) 그 위에 드랍 확률을 한 겹 더 얹으면
 * "6마리를 뽑았나"라는 단 하나의 질문이 흐려진다 (T17).
 */
export const MATERIAL_GUARANTEED_SIZE = 6;

/**
 * 몬스터 장비 드랍 (§4.4, T17_6). **처치마다 한 번** 굴린다 — 기본 3%에 LUK의 dropMult를 곱한다.
 * 부위는 몬스터가, 티어는 사냥터가 정한다 (content의 fieldDropTier).
 * 개별 보상처럼 처치 즉시 들어오므로 도망·사망해도 남는다.
 */
export const DROP_RATE = 0.03;

/** 드랍 등급 비율 (T17_6). 합이 1이다. 전설은 상점에 없어서 여기서만 나온다 */
export const DROP_RARITY: Partial<Record<GridRarity, number>> = {
  common: 0.4,
  uncommon: 0.3,
  rare: 0.15,
  epic: 0.1,
  legendary: 0.05,
};

/**
 * 보스 확정 드랍의 등급 (T17_5). common·uncommon은 안 나온다 — 관문 값을 한 보상이다.
 * 티어는 **다음 지역 앞단**이라 보스를 잡는 레벨(지역 끝)에서 바로 낄 수 있다.
 */
export const BOSS_DROP_RARITY: Partial<Record<GridRarity, number>> = {
  rare: 0.5,
  epic: 0.3,
  legendary: 0.2,
};

/** 비율표에서 등급 하나를 뽑는다. 표의 합이 1이라 마지막 칸이 나머지를 받는다. */
export function rollRarity(
  weights: Partial<Record<GridRarity, number>>,
  rng: () => number,
): GridRarity {
  const entries = Object.entries(weights) as [GridRarity, number][];
  let r = rng();
  for (const [rarity, weight] of entries) {
    r -= weight;
    if (r < 0) return rarity;
  }
  return entries.at(-1)![0];
}

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

/** 부위 7종 (§4.5). 하의는 T17_4에 들어왔다. 순서는 화면에 늘어놓는 순서다 */
export const GEAR_SLOTS = [
  'weapon',
  'helm',
  'armor',
  'pants',
  'gloves',
  'boots',
  'accessory',
] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];

/** 장비 티어 10단계 — 지역마다 2단계씩 (§7.2). 몬스터 티어(1~25)와는 다른 축이다. */
export const GEAR_TIERS = 10;
export const GEAR_TIERS_PER_REGION = GEAR_TIERS / REGION_COUNT;

/** 상점·드랍이 쓰는 등급 그리드 5종. 티어 × 부위 × 등급으로 350종이 나온다 (§7.2). */
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type GridRarity = (typeof RARITIES)[number];
/** 상점이 파는 등급 (T17_6). **전설은 드랍으로만 나온다** — 사서 끼는 물건이 아니다 */
export const SHOP_RARITIES: readonly GridRarity[] = ['common', 'uncommon', 'rare', 'epic'];
/**
 * 사냥터 고유 장비 (§4.4, §4.5). 그리드 밖이라 따로 둔다 —
 * 티어 × 부위로 뽑는 게 아니라 **사냥터 35곳에 1:1로 붙는다.**
 */
export const UNIQUE_RARITY = 'unique';
export const ALL_RARITIES = [...RARITIES, UNIQUE_RARITY] as const;
export type Rarity = (typeof ALL_RARITIES)[number];

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
  // §4.5 — "같은 tier common보다 높고 rare보다 낮다". 소재를 모아야 얻는 대신 확정이다
  unique: 1.25,
};

/** 등급별 가격 배율. 위 등급은 드랍으로 먹는 것이지 사는 게 아니라 가파르다. */
export const RARITY_PRICE: Record<Rarity, number> = {
  common: 1,
  uncommon: 2.2,
  rare: 5,
  epic: 12,
  legendary: 30,
  // 고유 장비는 골드로 못 산다. 이 값은 **판매가 계산에만** 쓰인다
  unique: 6,
};

/**
 * 부위가 가져가는 몫 (§4.5). **스탯마다 합이 1.0**이라 7부위 풀세트가 곧 그 티어의 몫이다.
 *
 * T16_1에서 부위마다 **성격을 뾰족하게** 다시 갈랐다. 전에는 무기만 빼면 여섯 칸이
 * 다 비슷해서, 어느 부위를 갈든 같은 물건을 하나 더 끼는 느낌이었다.
 * 0이 많은 건 실수가 아니라 정체성이다 — 신발을 안 끼면 장비 SPD가 통째로 없고,
 * 장신구를 안 끼면 LUK이 통째로 없다.
 *
 *   무기   공격력만            장갑   셋 다 조금씩
 *   투구   HP 많이 · DEF 조금   신발   SPD 전부 · DEF 조금
 *   갑옷   DEF 많이 · HP 조금   장신구 LUK 전부
 *   하의   HP · DEF 반반
 *
 * 하의(T17_4)는 투구·갑옷·장갑의 HP·DEF를 조금씩 떼어 만들었다. 풀세트 합은 그대로라
 * 밸런스 기준선이 안 움직이고, 대신 **하의를 안 입으면 HP·DEF가 5분의 1쯤 빈다.**
 */
export const SLOT_BIAS: Record<
  GearSlot,
  { atk: number; maxHp: number; def: number; spd: number; luk: number }
> = {
  weapon: { atk: 0.75, maxHp: 0, def: 0, spd: 0, luk: 0 },
  helm: { atk: 0, maxHp: 0.4, def: 0.1, spd: 0, luk: 0 },
  armor: { atk: 0, maxHp: 0.25, def: 0.35, spd: 0, luk: 0 },
  pants: { atk: 0, maxHp: 0.2, def: 0.2, spd: 0, luk: 0 },
  gloves: { atk: 0.25, maxHp: 0.15, def: 0.1, spd: 0, luk: 0 },
  boots: { atk: 0, maxHp: 0, def: 0.25, spd: 1, luk: 0 },
  accessory: { atk: 0, maxHp: 0, def: 0, spd: 0, luk: 1 },
};

/**
 * common 풀세트가 올려주는 SPD 비율 (§4.5). **레벨과 무관하게 항상 이만큼이다.**
 *
 * SPD만 다른 스탯과 계산이 다르다. ATK/HP/DEF처럼 gearShare에 비례시키면
 * 티어 10 신발 한 켤레가 맨몸 SPD보다 많이 준다(+147 vs 109) — 모두가 공짜로
 * 민첩 몰빵 속도를 갖게 되어 AGI 배분이 다시 죽는다.
 * 행동 횟수는 **비율**이 전부라(§4.2) 절대량을 키울 이유도 없다.
 * SPD의 주인은 AGI고 장비는 거드는 정도여야 한다.
 */
export const GEAR_SPD_RATE = 0.15;

/**
 * 풀 장신구가 주는 LUK의 기준값 (§4.5, T16_1). gearShare에 비례한다.
 *
 * LUK은 배분 포인트라 다른 스탯처럼 "맨몸의 몇 배"로 못 잡는다 — 행운을 안 찍은
 * 캐릭터는 맨몸 LUK이 4에서 멈춰 있어 비례시킬 바닥이 없다. 그래서 절대값을 놓고
 * 장비 몫(gearShare)만큼 키운다: 티어 1 +1.7 → 티어 10 +16.7.
 *
 * 3인 이유는 **Lv50 행운 몰빵이 151**이기 때문이다. 풀세트가 17이면 몰빵의 11%라,
 * 장신구가 행운을 거들되 배분을 대신하지는 않는다. 더 키우면 LUK 배분이 죽는다.
 */
export const GEAR_LUK_BASE = 3;

/** 부위별 가격 몫. 합이 부위 수(7.0)라 "풀세트 = 세트 가격"이 그대로 성립한다. */
export const SLOT_PRICE: Record<GearSlot, number> = {
  weapon: 1.5,
  helm: 0.9,
  armor: 1.2,
  pants: 1.0,
  gloves: 0.8,
  boots: 0.8,
  accessory: 0.8,
};

/** 품질 범위 (§4.5). 삼각분포라 1.0 근처가 흔하고 양 끝이 드물다. */
export const QUALITY_MIN = 0.8;
export const QUALITY_MAX = 1.2;

/**
 * 사냥터 고유 장비가 **그 사냥터 몬스터에게** 더 주는 피해 (§4.5).
 *
 * 등급으로는 common과 rare 사이(1.25배)지만, 제자리에서는 rare를 넘는다 —
 * "여기 전용"이라는 말이 숫자로 성립해야 소재를 모을 이유가 생긴다.
 * 여러 부위가 같은 traits를 덮어도 **제일 큰 것 하나만** 적용한다. 곱해서 쌓이면 안 된다.
 */
export const UNIQUE_TRAIT_BONUS = 0.2;

/** 강화 (§4.5). 최종 스탯 = 기본 × quality × 1.1^강화. */
export const ENHANCE_MAX = 10;
export const ENHANCE_MULT = 1.1;

/**
 * 강화 성공률 (§4.5). **표가 곧 기획이라 근사식을 만들지 않는다** —
 * 식으로 바꾸면 끝자리가 달라지고, 그 끝자리가 +8~+10의 체감을 정한다.
 * 인덱스 i는 "+i+1로 올리는 시도"다. +1·+2는 확정이고 +8부터 20%/15%/10%로 떨어진다.
 */
export const ENHANCE_RATE = [1, 1, 0.9, 0.75, 0.6, 0.45, 0.3, 0.2, 0.15, 0.1] as const;

/**
 * 지역마다 **보통으로 투자한 사람**이 입고 있을 장비 (T17_6 검수) — 몬스터와 보스를 여기에 맞춘다.
 * 그 레벨에 그 지역에서 살 수 있는 가장 높은 티어를 이 등급·강화로 한 벌(품질 100%) 입은 사람이,
 * 적정 레벨 1:1에서 **예전 common +0이 difficulty 1.0 몬스터에게 잃던 만큼** 잃게 regions.json의
 * difficulty를 잡았다. 보스 배율도 "지역 끝 레벨 · 이 장비 · 물약 3개로 승률 50%"다.
 * 지역 1은 입문이라 그대로 두고 뒤로 갈수록 더 요구한다 — common 한 벌의 1 / 1.33 / 1.53 / 1.68 / 1.80배.
 * **더 가파르면 못 산다.** uncommon +5(1.85배)는 한 벌이 common 한 벌 값의 14배(지역 수입 약 14일치)라
 * 지역 5에서 티어가 두 번 바뀌는 동안 수입의 70%가 장비로 나간다 — 시뮬 투자형이 152일로 무너졌다.
 */
export const EXPECTED_GEAR: readonly { rarity: GridRarity; enhance: number }[] = [
  { rarity: 'common', enhance: 0 },
  { rarity: 'common', enhance: 3 },
  { rarity: 'uncommon', enhance: 3 },
  { rarity: 'uncommon', enhance: 4 },
  { rarity: 'rare', enhance: 3 },
];

/** 비용 곡선 (§4.5). 장비가격 × 0.3 × 1.5^(N-1) — 단계마다 1.5배씩 비싸진다. */
export const ENHANCE_COST_RATE = 0.3;
export const ENHANCE_COST_GROWTH = 1.5;

/** `next`단계(1~10)로 올리는 데 드는 골드. 실패해도 나간다. */
export function enhanceCost(price: number, next: number): number {
  return Math.round(price * ENHANCE_COST_RATE * ENHANCE_COST_GROWTH ** (next - 1));
}

/**
 * +6부터는 강화에 **그 장비 지역의 사냥터 소재**가 든다 (T17_6 검수). 인덱스는 enhanceRate와 같고
 * 값은 필요한 소재 수다. **한 사냥터에서 하나씩** — +7이면 서로 다른 두 곳, +10이면 그 지역 일곱 곳 전부.
 * 소재는 **성공할 때만** 쓴다. 실패는 골드만 나간다 — 시도마다 쓰면 +10 한 번에 소재 70개(7개 × 기대 10회)라
 * 지역 5를 다 돌아도 모이는 30개 안팎으로는 영영 못 간다.
 */
export const ENHANCE_MATERIALS = [0, 0, 0, 0, 0, 1, 2, 3, 4, 7] as const;

/** `next`단계 강화에 드는 소재 수. 0이면 골드만 든다. */
export function enhanceMaterials(next: number): number {
  return ENHANCE_MATERIALS[next - 1] ?? 0;
}

/**
 * 보스 버프 (T17_6 검수) — 보스에 들어갈 때 **그 지역 소재를 최대 3개** 쓰면 하나에 하나씩, 전투력 탭의
 * 값 중 하나가 무작위로 ×1.1이 된다(지금 값에 곱한다. 같은 게 두 번 나오면 ×1.21). 그 판에만 붙는다.
 * 마법 공격은 뺐다 — 스킬(T18) 전에는 붙어도 아무 일이 없어서 소재만 버린다.
 */
export const BOSS_BUFF = { max: 3, mult: 1.1 } as const;
export const BOSS_BUFF_STATS = ['atk', 'def', 'spd', 'cri', 'crd', 'eva'] as const;
export type BossBuffStat = (typeof BOSS_BUFF_STATS)[number];

/** `next`단계로 올릴 확률. 상한을 넘으면 0 — 호출부가 더 못 올린다는 걸 이걸로 안다. */
export function enhanceRate(next: number): number {
  return ENHANCE_RATE[next - 1] ?? 0;
}

/**
 * +N까지 올리는 데 드는 **기대** 시도 수와 골드 (§4.5).
 * 실패해도 단계가 안 내려가므로 단계마다 1/성공률 번씩 두드리면 된다 — 단계끼리 독립이다.
 */
export function enhanceExpected(price: number, target = ENHANCE_MAX) {
  let tries = 0;
  let gold = 0;
  for (let n = 1; n <= target; n++) {
    tries += 1 / enhanceRate(n);
    gold += (1 / enhanceRate(n)) * enhanceCost(price, n);
  }
  return { tries, gold: Math.round(gold) };
}

/** 품질을 뽑는다. 난수 둘의 평균이 삼각분포가 된다 — 표를 따로 들 필요가 없다 (§4.5). */
export function rollQuality(rng: () => number): number {
  const t = (rng() + rng()) / 2;
  return Math.round((QUALITY_MIN + (QUALITY_MAX - QUALITY_MIN) * t) * 100) / 100;
}

/**
 * 인스턴스 하나의 최종 스탯 (§4.5). 기본 × 품질 × 1.1^강화.
 *
 * **한 단계는 최소 1을 올린다.** 기본값이 작으면 1.1배가 반올림에 먹혀서
 * 강화를 해도 화면이 안 움직인다(기본 5짜리 무기는 +2·+4가 통째로 안 보였다).
 * 기본이 10을 넘으면 1.1배가 이미 1보다 크므로 이 바닥은 저절로 안 쓰인다 —
 * 낮은 티어에서만 일하고 높은 티어에서는 §4.5 표 그대로다.
 */
export function itemStat(base: number, quality: number, enhance: number): number {
  const scaled = base * quality * ENHANCE_MULT ** enhance;
  if (base <= 0 || enhance === 0) return scaled;
  return Math.max(scaled, Math.round(base * quality) + enhance);
}

/**
 * 장비 한 점의 기본 스탯 (§4.5).
 *
 * 기준은 **그 레벨의 맨몸 스탯**이다. gearShare(level)만큼을 7부위가 나눠 가지므로
 * common 풀세트를 갖춰 입으면 ATK·HP·DEF가 정확히 powerScale(level)배가 된다.
 * SPD와 LUK만 계산이 다르다 — 둘 다 맨몸이 선형(또는 고정)이라 비례시킬 바닥이 없다.
 * 회피는 여전히 안 준다. AGI가 SPD와 회피를 다 잃으면 배분할 이유가 없어진다.
 */
export function gearStats(level: number, slot: GearSlot, rarity: Rarity) {
  const naked = combatStats(level);
  const share = gearShare(level) * RARITY_MULT[rarity];
  const bias = SLOT_BIAS[slot];
  return {
    atk: Math.round(naked.atk * share * bias.atk),
    maxHp: Math.round(naked.maxHp * share * bias.maxHp),
    def: Math.round(naked.def * share * bias.def),
    // SPD는 gearShare를 안 쓴다 — 레벨이 올라도 "풀세트 = +15%"로 일정하다.
    // 소수 한 자리로 두는 건 정수로 자르면 낮은 티어 신발이 통째로 +0이 되기 때문이다
    spd: round1(naked.spd * GEAR_SPD_RATE * RARITY_MULT[rarity] * bias.spd),
    // LUK도 맨몸에 비례시키지 않는다 — 행운 0점이면 곱할 바닥이 4뿐이다.
    // SPD와 같은 이유로 소수 한 자리다: 정수로 반올림하면 티어 1~2가 둘 다 +2가 되어
    // 부적을 갈아도 아무 일이 안 일어난다
    luk: round1(GEAR_LUK_BASE * share * bias.luk),
  };
}

/**
 * 지역별 하루 골드 수입 (§6.3). 장비 가격을 여기에 묶어 둔다 —
 * §4.5의 "common 풀세트 ≈ 그 지역 하루 수입 1일치"가 계수가 아니라 정의가 된다.
 */
export const REGION_DAILY_GOLD = [2_020, 4_041, 6_061, 8_081, 10_102] as const;

/** 장비 티어가 속한 지역 (§7.2). 티어 1~2가 지역 1이다. */
export function regionOfGearTier(gearTier: number): number {
  return Math.ceil(gearTier / GEAR_TIERS_PER_REGION);
}

/** 성장 곡선이 끝나는 레벨 (§6.2). 장비 값의 기준점이기도 하다. */
export const MAX_LEVEL = 50;

/**
 * 장비 값의 계수 (§4.5).
 *
 * T13에서는 "그 지역 하루 수입 1일치"로 묶었는데, 그러면 **티어 1 풀세트가 1,616골드인데
 * 주는 건 ATK +1 · HP +12**가 된다 — 첫 구매가 함정이었다. 값을 **그 장비가 실제로 주는 몫**
 * (gearShare)에 비례시키면 어느 티어를 사도 골드당 얻는 게 같아진다.
 * 계수는 **Lv50 풀세트가 지역 5 하루 수입의 1.2일치**가 되게 잡았다.
 */
export const GEAR_PRICE_K = (REGION_DAILY_GOLD[REGION_COUNT - 1] * 1.2) / gearShare(MAX_LEVEL);

/** 그 레벨용 common 풀세트의 값 (§4.5). 인자가 티어가 아니라 레벨인 건 값이 성능을 따르기 때문. */
export function gearSetPrice(refLevel: number): number {
  return GEAR_PRICE_K * gearShare(refLevel);
}

/** 장비 한 점의 값. 풀세트를 다 더하면 gearSetPrice가 된다 (SLOT_PRICE 합이 부위 수). */
export function gearPrice(refLevel: number, slot: GearSlot, rarity: Rarity): number {
  return Math.round(
    (gearSetPrice(refLevel) / GEAR_SLOTS.length) * SLOT_PRICE[slot] * RARITY_PRICE[rarity],
  );
}

// ─────────────────────────────────────────────────────────────
// 경제 (§4.5, §3.7) — T14
// ─────────────────────────────────────────────────────────────

/**
 * 장비를 되팔 때 받는 비율 (§4.5). 정가 × 품질 × 이 값.
 *
 * T17_6에서 0.25 → 0.1로 내렸다. 몬스터가 장비를 떨구게 되면서(처치마다 3% × LUK)
 * 0.25로는 주운 걸 파는 돈이 사냥 수입의 8%가 됐다 — 전설 하나 팔면 하루치다.
 * 0.1이면 3% 남짓이라 드랍은 "팔아서 버는 것"이 아니라 "끼는 것"으로 남는다.
 */
export const SELL_RATE = 0.1;

/**
 * 가방 (§4.5, T17_2). **낀 장비는 안 센다** — 몸에 있는 것이지 가방에 있는 게 아니다.
 *
 * 20에서 시작해 8번 늘리면 60이다. 60은 T13부터 쓰던 상한이고, 이제 공짜가 아니라
 * 사야 하는 것이 됐다. 차면 드랍만 건너뛰고 사냥은 계속된다.
 */
export const BAG = {
  capacity: 20,
  /** 확장 한 번에 늘어나는 칸 */
  step: 5,
  /** 8회 → 60칸 */
  maxExpansions: 8,
  /** 확장마다 값이 1.6배 */
  growth: 1.6,
} as const;

/**
 * 다음 확장에 드는 골드 (§4.5). 첫 번째가 **지역 1 하루 수입의 반나절치**고
 * 거기서 1.6배씩 오른다 — 1,010 → 1,616 → … → 27,112, 8번 다 하면 약 70,600이다.
 * 평생 수입(약 95만)의 7% 정도라, 강화·창고와 나란히 놓을 만한 크기다.
 */
export function bagExpandCost(expansions: number): number {
  return Math.round(REGION_DAILY_GOLD[0] * 0.5 * BAG.growth ** expansions);
}

/** 창고 (§3.7). 한도가 진짜 제약이고, 넘치는 만큼은 들고 다녀야 한다. */
export const VAULT = {
  /** 초기 한도 — 지역 1 하루 수입의 약 2.5일치 */
  capacity: 5_000,
  /** 입금 수수료. 출금은 무료 */
  fee: 0.02,
  /** 확장마다 한도 2배 */
  step: 2,
  /** 확장 상한 8회 → 최대 1,280,000골드 */
  maxExpansions: 8,
  /** 확장 비용 = 현재 한도 × 0.6 */
  costRate: 0.6,
} as const;

/** 다음 확장에 드는 골드 (§3.7). 5,000 →(3,000)→ 10,000 →(6,000)→ 20,000 … */
export function vaultExpandCost(capacity: number): number {
  return Math.round(capacity * VAULT.costRate);
}

/**
 * 여관비 (§4.5). `150 × r × 1.1^(r-1)` — 150 / 330 / 545 / 799 / 1,098.
 * regions.json의 town.inn에 박혀 있고 validate가 이 식과 대조한다.
 */
export function innCost(region: number): number {
  return Math.round(150 * region * 1.1 ** (region - 1));
}
