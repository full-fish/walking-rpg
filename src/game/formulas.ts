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
 * 1차 스탯을 뺀 나머지 기본값 (§4.3). 전사 Lv1 맨몸은 HP 100 / ATK 20 / DEF 5 / SPD 15다.
 *
 * **ATK·HP·DEF·SPD 모두 "포인트 10점어치"로 맞췄다** (T17_7 검수 4차) — 기본값 + 전사 시작 스탯이
 * ATK 10+2×5 · HP 40+10×6 · DEF 2+0.5×6 · SPD 9+1.5×4로, 전부 1점 값의 10배다.
 * 바닥이 다르면 바닥이 낮은 스탯의 1점이 더 세서 그쪽으로 쏠린다(ATK 0 · SPD 4일 때 힘·민첩이 셌다).
 */
export const BASE_STATS = {
  maxHp: 40,
  /** 마나. INT를 뺀 나머지 — 전사 Lv1이 60, 마법사가 100이 되는 값 */
  maxMp: 20,
  atk: 10,
  /** 마법 공격력. 스킬이 생기면(T18) 여기서 출발한다 */
  matk: 0,
  def: 2,
  spd: 9,
  /** 크리 확률 */
  cri: 0.04,
  /** 크리 배율 — 고정이다. 행운은 확률만 올린다 (T17_7 검수 4차) */
  crd: 3,
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
 * 몬스터 SPD는 그 레벨 기준 플레이어(네 스탯 균등)의 1/1.2다(MONSTER_BASE.spd) — **균등이 1.2배**다.
 * 민첩 몰빵은 SPD가 균등의 약 2배라 2.4~2.6배, 민첩 0점은 0.8배쯤이다 (T17_7 검수 4차).
 * 3배 상한은 몰빵 + 좋은 신발 + 느린 원형이 겹쳐야 닿는다.
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
 * **HP·ATK·DEF·SPD는 자동으로 안 오른다** (T17_7 검수 4차) — 레벨업은 포인트 3점만 준다.
 * 캐릭터 몫(Lv50 전투력의 40%)이 전부 찍은 포인트라야 배분이 제대로 갈린다. 자동 성장이 있으면
 * 그만큼이 모두에게 같은 바닥이 되어 몰빵과 균등의 차이가 묽어진다.
 * MP와 마법 공격력은 스킬(T18) 몫이라 남겨 둔다.
 */
export const JOB_GROWTH = {
  warrior: { maxMp: 2, matk: 0.2 },
  rogue: { maxMp: 3, matk: 0.5 },
  mage: { maxMp: 8, matk: 3.0 },
} as const;

export type JobId = keyof typeof JOB_GROWTH;

/**
 * 1차 스탯 1포인트당 효과 (§4.3). 이 값이 곧 캐릭터 몫이다 — 레벨 자동 성장이 없다(JOB_GROWTH).
 *
 * **네 스탯에 고르게 찍는 게 제일 세다** (T17_7 검수 4차). 장비는 기준 맨몸(네 스탯 균등)의
 * 같은 배수를 ATK·HP·DEF·SPD에 똑같이 얹는다(gearStats) — 스탯마다 "포인트 말고 깔린 몫"의
 * 비율이 같으면, 곱해지는 값들은 고르게 나눌 때 곱이 제일 크다. 몰빵은 그 스탯이 균등의 약 2배가
 * 되는 대신 나머지가 0.6배로 떨어져 손해다.
 */
export const STAT_PER_POINT = {
  str: { atk: 2 },
  vit: { maxHp: 10, def: 0.5 },
  agi: { spd: 1.5, eva: 0.001 },
  /**
   * 기댓값을 증폭하는 스탯 — 치명 확률과 골드·드랍 (T13, T17_4).
   * **치명 확률만 올리고 배율은 ×3 고정이다** (T17_7 검수 4차). 둘 다 오르면 곱이라 점수가 쌓일수록
   * 더 붙어서, 초반엔 쓸모없고 후반 몰빵은 매번 6배로 터졌다. 확률만 오르면 1점 값이 일정하다.
   * **상한은 두지 않는다** — 확률이 100%를 넘으면 늘 터질 뿐이다(Lv50 행운 몰빵쯤).
   * 치명은 평타 몫이 늘 깔려 있어 전투만 보면 힘·체력·민첩 1점보다 조금 약하다. 골드·드랍이 그 몫이다.
   * 드랍·골드는 1점당 **+2%**, 가산이다. dropRate는 몬스터 장비 드랍과
   * 4·5마리 판의 소재 확률에 곱한다 (MATERIAL_CHANCE).
   */
  luk: { cri: 0.008, dropRate: 0.02, goldFind: 0.02 },
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
 * 네 스탯에 똑같이 나눈 배분 (T17_7 검수) — **밸런스 기준 플레이어**다. 레벨당 3점이라 소수가 나온다.
 * 장비 값(gearStats)·몬스터(referencePlayer)·보스 배율·벤치가 전부 이 사람을 기준으로 잰다.
 */
export function evenSpend(level: number): StatSpend {
  const each = (Math.max(0, level - 1) * POINTS_PER_LEVEL) / SPENDABLE_STATS.length;
  return { str: each, vit: each, agi: each, luk: each, int: 0 };
}

/**
 * 진행 단계별 기대 전투력 배수 (§4.3, §4.5). Lv50에서 **2배**다.
 *
 * 맨몸 스탯은 찍은 포인트에 **선형**으로 는다 — STR 1점이 언제나 딱 ATK +2다.
 * 그 위에 장비가 gearShare만큼 얹는다: Lv1 0.5(전투력의 33%) → Lv50 1.5(**60%**).
 * T17_7 검수 4차 전에는 1.04라 Lv50 장비가 6.33(86%)이었다 — 힘 1점이 ATK의 0.13%로 묽어져
 * 배분이 거의 의미가 없었다. 몬스터는 기준 플레이어를 따라가므로(referencePlayer) 같이 작아졌다.
 *
 * **스탯에 곱하지 않는다.** 이 값이 쓰이는 곳은 둘뿐이다 —
 *   ① gearShare()   그 단계 장비가 채워야 할 몫
 *   ② damageMultiplier()의 K 기준선 (그 단계의 기대 DEF 크기)
 */
export const POWER_GROWTH = 2 ** (1 / 49);

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
 */
export const GEAR_FLOOR = 0.5;

/**
 * 그 레벨에서 **장비가 채워야 하는 몫** (§4.5). 맨몸 대비 몇 배를 더 얹느냐다.
 * Lv1은 0.5(전투력의 33%), Lv50은 1.5(60%).
 */
export function gearShare(level: number): number {
  return powerScale(level) - 1 + GEAR_FLOOR;
}

/** 장비가 더해주는 몫. items.ts의 GearBonus와 같은 모양이다 (formulas는 items를 import하지 않는다) */
type Gear = { atk: number; maxHp: number; def: number; spd: number; luk: number };
const NO_GEAR: Gear = { atk: 0, maxHp: 0, def: 0, spd: 0, luk: 0 };

/**
 * 레벨·배분·장비로 전투 스탯을 만든다 (§4.3, §4.5). 화면·전투·벤치가 전부 여기를 지난다.
 *
 * 1차 스탯 = 직업 시작값 + 배분한 포인트(+ 장신구 LUK). 장비는 그 위에 **더하기만** 한다.
 * 배분을 안 주면 네 스탯 균등(evenSpend)으로 친다 — **장비 곡선의 기준 맨몸**이다.
 * 여기서 나오는 값은 전부 표에 적힌 그대로다. 숨은 배수는 없다.
 */
export function combatStats(
  level: number,
  job: JobId = 'warrior',
  spend: StatSpend = evenSpend(level),
  gear: Gear = NO_GEAR,
) {
  const ups = Math.max(0, level - 1);
  const growth = JOB_GROWTH[job];
  const start = STARTING_STATS[job];
  const s = {
    str: start.str + spend.str,
    vit: start.vit + spend.vit,
    agi: start.agi + spend.agi,
    // 장신구가 주는 LUK은 1차 스탯이라 파생 4종에 전부 얹힌다 (§4.3, T16_1)
    luk: start.luk + spend.luk + gear.luk,
    int: start.int + spend.int,
  };
  return {
    maxHp: Math.round(BASE_STATS.maxHp + STAT_PER_POINT.vit.maxHp * s.vit + gear.maxHp),
    /** 스킬 자원. 쓰는 곳은 T18 */
    maxMp: Math.round(BASE_STATS.maxMp + growth.maxMp * ups + STAT_PER_POINT.int.maxMp * s.int),
    atk: BASE_STATS.atk + STAT_PER_POINT.str.atk * s.str + gear.atk,
    /** 마법 공격력. 평타는 아직 ATK만 쓴다 — 마법 평타·스킬은 T18 */
    matk: BASE_STATS.matk + growth.matk * ups + STAT_PER_POINT.int.matk * s.int,
    def: BASE_STATS.def + STAT_PER_POINT.vit.def * s.vit + gear.def,
    spd: BASE_STATS.spd + STAT_PER_POINT.agi.spd * s.agi + gear.spd,
    cri: BASE_STATS.cri + STAT_PER_POINT.luk.cri * s.luk,
    crd: BASE_STATS.crd,
    eva: BASE_STATS.eva + STAT_PER_POINT.agi.eva * s.agi,
    /** 드랍 배율 — 장비 드랍과 4·5마리 판의 소재 확률에 곱한다 (T19, T17_7 검수 4차) */
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
 * 지역마다 사냥터 7개 (§4.4, T17_4). 사냥터마다 소재가 하나씩 따로 나온다 — +10 강화와
 * 전설 반지가 그 지역 일곱 곳을 전부 요구한다 (T17_6 검수, T17_7).
 */
export const FIELDS_PER_REGION = 7;

/**
 * 몬스터가 맞추는 **기준 플레이어** (§7.2④, T17_7 검수 4차) — 그 레벨, 네 스탯 균등,
 * 그 지역 보통 투자(EXPECTED_GEAR) 한 벌(품질 100%). 몬스터 스탯은 전부 이 사람에 비례한다.
 *
 * 전에는 몬스터가 티어당 1.2배로 따로 자라서, 플레이어 공식을 건드릴 때마다 곡선이 어긋났다.
 * 이제 플레이어 쪽(1점 값·장비 몫)을 바꾸면 몬스터가 저절로 따라온다.
 */
export function referencePlayer(level: number, region: number) {
  const naked = combatStats(level);
  const { rarity, enhance } = EXPECTED_GEAR[region - 1];
  const worn = gearShare(level) * RARITY_MULT[rarity] * ENHANCE_MULT ** enhance;
  return combatStats(level, 'warrior', evenSpend(level), {
    atk: naked.atk * worn,
    maxHp: naked.maxHp * worn,
    def: naked.def * worn,
    spd: naked.spd * worn,
    luk: GEAR_LUK_BASE * worn,
  });
}

/**
 * 기준 몬스터 (§7.2④) — 기준 플레이어에 대한 배수다.
 *
 *   hp   기준 플레이어의 한 방(치명 기댓값 포함) 몇 대 분량인가
 *   atk  한 방이 기준 플레이어 HP의 몇 할인가 (그 사람의 DEF로 깎인 뒤)
 *   def  피해 감소율을 정한다 — def/K가 일정해서 몬스터 DEF는 어디서나 약 8%를 깎는다
 *   spd  기준 플레이어 SPD의 1/1.2 — **균등 배분이 1.2배 빠르다** (T17_7 검수 4차)
 *
 * hp·atk는 T17_7 검수 4차에 벤치로 다시 맞췄다 — 적정 레벨 1:1에서 전과 같은 만큼 잃는다.
 */
export const MONSTER_BASE = { hp: 5.5, atk: 0.016, def: 4.2, spd: 1 / 1.2 } as const;

/**
 * 뒤로 갈수록 싸움이 길어진다 — Lv50에서 **2.2배** (§7.2④). HP는 이만큼 늘리고 ATK는 이만큼 줄여서
 * 한 마리에 잃는 몫은 그대로 두고 한 방만 작게 만든다. 한 방이 크면 물약 기준선을 자주 넘고 한 방에
 * 죽는 일이 늘어 후반 유지비가 치솟는다(T17_7 검수 4차에서 지역 5가 54%). 예전 곡선(HP만 1.223)과 같은 뜻이다.
 */
export const MONSTER_LENGTH_GROWTH = 2.2 ** (1 / 49);

export type StatBias = { hp: number; atk: number; def: number; spd: number };

/**
 * 몬스터 한 마리의 스탯 (§7.2④). 원형 × 기준 플레이어(그 티어의 적정 레벨) × 지역 난이도.
 *
 * SPD에만 power와 난이도를 곱하지 않는다 — 행동 횟수가 SPD 비율에 직접 비례하므로(§4.2)
 * 곱하면 센 원형이 상한에 쉽게 닿는다.
 */
export function monsterStats(
  level: number,
  region: number,
  difficulty: number,
  power: number,
  bias: StatBias,
) {
  const ref = referencePlayer(level, region);
  const common = difficulty * power;
  const length = MONSTER_LENGTH_GROWTH ** Math.max(0, level - 1);
  return {
    // 치명타 기댓값까지 친 한 방 — 행운 값을 바꿔도 몬스터가 같이 따라온다
    maxHp: Math.round(
      MONSTER_BASE.hp * length * ref.atk * (1 + ref.cri * (ref.crd - 1)) * common * bias.hp,
    ),
    atk: round2(
      ((MONSTER_BASE.atk * ref.maxHp) / damageMultiplier(ref.def, ref.scale) / length) *
        common *
        bias.atk,
    ),
    def: round2(MONSTER_BASE.def * ref.scale * common * bias.def),
    spd: round2(MONSTER_BASE.spd * ref.spd * bias.spd),
    scale: round2(ref.scale * difficulty),
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
 * 판을 끝까지 깼을 때 소재가 나올 확률 — 마릿수별 (§4.4, T17_7 검수 4차).
 * 6마리는 확정, 5마리 50%, 4마리 20%, 3마리 이하는 안 나온다. 4·5마리 확률에는
 * 드랍 배율(행운 · 반지)을 곱한다 — 6마리 확정이던 때는 하루 0.5~0.8개라 반지 하나 올리는 데 한 달이 걸렸다.
 */
export const MATERIAL_CHANCE: Partial<Record<number, number>> = { 4: 0.2, 5: 0.5, 6: 1 };

/** 그 마릿수 판을 다 깼을 때 소재가 나올 확률. 1을 넘지 않는다 */
export function materialChance(size: number, dropMult: number): number {
  const base = MATERIAL_CHANCE[size] ?? 0;
  return base >= 1 ? 1 : Math.min(1, base * dropMult);
}

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

/**
 * 한 판의 마릿수를 뽑는다. 입장 시점에 정해지고 끝까지 안 보여준다 (§4.4).
 * `extraSix`는 반지(T17_7) — 6마리 칸을 그만큼(%p) 늘리고 나머지 칸을 같은 비율로 줄인다.
 */
export function rollRunSize(rng: () => number, extraSix = 0): number {
  const [biggest, six] = RUN_SIZE_WEIGHTS.at(-1)!;
  const rest = (1 - six - extraSix) / (1 - six);
  let r = rng();
  for (const [size, weight] of RUN_SIZE_WEIGHTS) {
    r -= size === biggest ? six + extraSix : weight * rest;
    if (r < 0) return size;
  }
  return biggest;
}

// ─────────────────────────────────────────────────────────────
// 장비 (§4.5) — Lv50 전투력의 60%가 여기서 나온다
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
 * 등급 배율 (§4.5). common이 밸런스 기준선이다 —
 * 시뮬레이터도 검증도 "그 지역 common 풀세트"로 잰다. 위 등급은 전부 초과 이득이다.
 */
export const RARITY_MULT: Record<GridRarity, number> = {
  common: 1.0,
  uncommon: 1.15,
  rare: 1.35,
  epic: 1.6,
  legendary: 1.9,
};

/** 등급별 가격 배율. 위 등급은 드랍으로 먹는 것이지 사는 게 아니라 가파르다. */
export const RARITY_PRICE: Record<GridRarity, number> = {
  common: 1,
  uncommon: 2.2,
  rare: 5,
  epic: 12,
  legendary: 30,
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
 * 풀 장신구가 주는 LUK의 기준값 (§4.5, T16_1). gearShare에 비례한다.
 *
 * LUK은 배분 포인트라 다른 스탯처럼 "맨몸의 몇 배"로 못 잡는다 — 행운을 안 찍은
 * 캐릭터는 맨몸 LUK이 4에서 멈춰 있어 비례시킬 바닥이 없다. 그래서 절대값을 놓고
 * 장비 몫(gearShare)만큼 키운다: 티어 1 +1.6 → 티어 10 +4.3 (Lv50 장비 몫 1.5, T17_7 검수 4차).
 *
 * 장신구는 행운을 거들 뿐 배분을 대신하지 않는다 — Lv50 행운 몰빵(151)의 3%다.
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
 * 지역마다 **보통으로 투자한 사람**이 입고 있을 장비 (T17_6 검수) — 몬스터와 보스를 여기에 맞춘다
 * (referencePlayer). 그 레벨 장비 몫을 이 등급·강화로 한 벌(품질 100%) 입은 사람이다.
 * 몬스터는 이 사람이 적정 레벨 1:1에서 T17_6과 같은 만큼 잃게 regions.json의 difficulty로 맞췄고,
 * 보스 배율은 "지역 끝 레벨 · 이 장비 · 물약 3개로 승률 30%"다 (T17_7 검수 4차).
 * common 한 벌의 1 / 1.21 / 1.39 / 1.53 / 1.63배. **시뮬 투자형이 관문에서 실제로 가진 세기**에 맞췄다 —
 * 신발이 SPD의 60%를 주게 되면서(T17_7 검수 4차) 장비가 뒤처지면 ATK·HP·SPD가 같이 떨어져,
 * 예전 값(… uncommon +4 · rare +3)으로는 시뮬 투자형이 기준보다 18% 약해 보스에서 몇 주씩 막혔다.
 */
export const EXPECTED_GEAR: readonly { rarity: GridRarity; enhance: number }[] = [
  { rarity: 'common', enhance: 0 },
  { rarity: 'common', enhance: 2 },
  { rarity: 'uncommon', enhance: 2 },
  { rarity: 'uncommon', enhance: 3 },
  { rarity: 'rare', enhance: 2 },
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

// ─────────────────────────────────────────────────────────────
// 반지 (T17_7) — 고유 장비 대신. 특수 소재로만 얻고 올린다
// ─────────────────────────────────────────────────────────────

/**
 * 반지 효과 11종 (T17_7). **전부 전투력 축 밖이다** — ATK·HP·DEF는 장비의 몫이라 반지가 올리면 또 겹친다.
 * 한 반지에 효과 하나. 두 칸에 같은 반지를 끼면 더해진다.
 */
export const RING_KINDS = [
  'fieldWp',
  'midnightWp',
  'bigRun',
  'clearBonus',
  'exp',
  'gold',
  'drop',
  'potion',
  'shield',
  'bossBuff',
  'bossDamage',
] as const;
export type RingKind = (typeof RING_KINDS)[number];

/**
 * ★1 일반 +0의 값 (T17_7) — 계획서 T17_7 표의 common 값. ★5 전설 +0이 이것의 약 5배(표의 legendary)다.
 * 입장 WP 4% 할인 · 자정 WP +100 · 6마리 판 +1%p · 클리어 보너스 +5% · EXP +2% · 골드 +3% ·
 * 장비 드랍 +5% · 물약 회복 +10% · 전투 시작 보호막(최대 HP의 3%) · 보스 버프 배율 +0.02 · 보스 피해 +3%
 */
export const RING_BASE: Record<RingKind, number> = {
  fieldWp: 0.04,
  midnightWp: 100,
  bigRun: 0.01,
  clearBonus: 0.05,
  exp: 0.02,
  gold: 0.03,
  drop: 0.05,
  potion: 0.1,
  shield: 0.03,
  bossBuff: 0.02,
  bossDamage: 0.03,
};

/**
 * ★와 등급 배율 (T17_7). ★N은 **지역 N의 소재로 올리는 반지**다 — ★1은 초원 소재로 일반에서 전설까지 가고,
 * 전설이 되면 숲 소재로 ★2 일반이 된다. **올라간 순간은 전보다 약하다**(★1 전설 1.5 > ★2 일반 1.35).
 * 대신 ★2 전설은 2.03이라 고점이 높다. ★5 전설이 4.95 — 표의 legendary(5배)다.
 */
export const RING_TIER_MULT = [1, 1.35, 1.8, 2.45, 3.3] as const;
export const RING_RARITY_MULT: Record<GridRarity, number> = {
  common: 1,
  uncommon: 1.125,
  rare: 1.25,
  epic: 1.375,
  legendary: 1.5,
};

/** 반지 칸 (T17_7). 장비 7부위와 따로다 */
export const RING_SLOTS = 2;

/**
 * 반지에 드는 소재 (T17_7) — **그 ★ 지역의 서로 다른 사냥터에서 하나씩**. 골드는 안 든다.
 * 교환(새 반지 = ★1 일반, 효과는 무작위) 3 · 등급 올리기 → uncommon 3 / rare 4 / epic 5 / legendary 7 ·
 * ★ 올리기(전설 → 다음 ★ 일반, **다음 지역** 소재) 3. 올리면 강화는 +0으로 돌아간다.
 */
export const RING_COST = { exchange: 3, rarity: [3, 4, 5, 7], tier: 3 } as const;

/** 사냥터 입장 WP 할인 상한 (T17_7) — 같은 반지 두 개를 끝까지 올려도 공짜가 되지는 않는다 */
export const RING_FIELD_WP_CAP = 0.5;

/** 반지 하나의 값 (T17_7) = 기본 × ★ × 등급 × 1.1^강화. 강화는 장비와 같은 표(성공률·값·소재)를 쓴다 */
export function ringValue(
  kind: RingKind,
  tier: number,
  rarity: GridRarity,
  enhance: number,
): number {
  return (
    RING_BASE[kind] * RING_TIER_MULT[tier - 1] * RING_RARITY_MULT[rarity] * ENHANCE_MULT ** enhance
  );
}

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
 * 기준은 **그 레벨의 맨몸 스탯**(네 스탯 균등)이다. gearShare(level)만큼을 7부위가 나눠 가지므로
 * common 풀세트를 갖춰 입으면 ATK·HP·DEF·SPD가 정확히 (1 + gearShare)배가 된다.
 * **SPD도 같은 배수다** (T17_7 검수 4차) — 전에는 +15%만 줘서 SPD만 "포인트 말고 깔린 몫"이
 * 작았고, 그래서 민첩 1점이 다른 1점보다 몇 배 셌다. 넷이 같은 배수라야 균등이 최선이다.
 * LUK만 계산이 다르다 — 절대값 기준이다(GEAR_LUK_BASE). 회피는 안 준다.
 */
export function gearStats(level: number, slot: GearSlot, rarity: GridRarity) {
  const naked = combatStats(level);
  const share = gearShare(level) * RARITY_MULT[rarity];
  const bias = SLOT_BIAS[slot];
  return {
    atk: Math.round(naked.atk * share * bias.atk),
    maxHp: Math.round(naked.maxHp * share * bias.maxHp),
    def: Math.round(naked.def * share * bias.def),
    // 소수 한 자리로 두는 건 정수로 자르면 낮은 티어 신발 차이가 반올림에 먹히기 때문이다
    spd: round1(naked.spd * share * bias.spd),
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
export function gearPrice(refLevel: number, slot: GearSlot, rarity: GridRarity): number {
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
