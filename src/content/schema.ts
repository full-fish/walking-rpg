/**
 * 콘텐츠 데이터의 런타임 스키마 (§7.2, §7.4).
 * React를 import하지 않는다 — Node에서 돌아야 한다.
 */
import { z } from 'zod';

import {
  FIELDS_PER_REGION,
  GEAR_SLOTS,
  GEAR_TIERS,
  MAX_TIER,
  RARITIES,
  REGION_COUNT,
} from '../game/formulas';

/** 원형에 곱하는 배율들. 1.0이 기준 (§7.2③). */
const multiplier = z.number().positive().max(3);
const rate = z.number().min(0).max(1);

/**
 * 몬스터 원형 하나 (§7.2②③).
 *
 * `tiers[i]`에 이 원형이 등장하고, 그때 쓰는 이름이 `namePool[i]`다.
 * 같은 값이 두 번 들어와도 된다 — 강함은 같고 이름만 다른 변종이 된다.
 * 실제 스탯은 gen-content.ts가 §7.2④ 공식으로 뽑는다 (T11).
 */
export const MonsterArchetypeSchema = z
  .object({
    id: z.string().regex(/^arch_[a-z]+$/, 'arch_소문자 형식이어야 한다'),
    label: z.string().min(1),
    /** 원형의 강함이자 보상 배율. 센 원형은 보상도 그만큼 준다 (§7.2④) */
    power: multiplier,
    statBias: z.object({ hp: multiplier, atk: multiplier, def: multiplier, spd: multiplier }),
    cri: rate,
    eva: rate,
    /** 내성·드랍 분기에 쓰는 태그. 무기 종류별 내성도 여기에 붙는다 (§7.2 주석 ⑥) */
    traits: z.array(z.string().min(1)).nonempty(),
    spriteTag: z.string().min(1),
    tiers: z.array(z.int().min(1).max(MAX_TIER)).nonempty(),
    namePool: z.array(z.string().min(1)).nonempty(),
    /**
     * 그 티어 몬스터가 떨구는 장비 부위 (T17_6). tiers와 1:1 — 몬스터마다 한 부위다.
     * 사냥터에서 나오는 부위는 풀에 있는 몬스터들의 부위를 모은 것이 된다.
     */
    drops: z.array(z.enum(GEAR_SLOTS)).nonempty(),
  })
  .refine((a) => a.tiers.length === a.namePool.length, {
    error: 'tiers와 namePool의 길이가 같아야 한다 (§7.4 #4)',
    path: ['namePool'],
  })
  .refine((a) => a.tiers.length === a.drops.length, {
    error: 'tiers와 drops의 길이가 같아야 한다 (T17_6)',
    path: ['drops'],
  });

export const MonsterArchetypesSchema = z.array(MonsterArchetypeSchema).nonempty();

export type MonsterArchetype = z.infer<typeof MonsterArchetypeSchema>;

const tier = z.int().min(1).max(MAX_TIER);

/**
 * 사냥터 하나 (§4.4, §7.2⑤).
 *
 * `pool`의 [원형, 티어]는 그 사냥터에서 나올 수 있는 몬스터다. 평균 power가 1.0에서
 * 멀어지면 그 사냥터만 유독 짜거나 후해진다 — validate가 ±0.15로 본다 (§7.4 #6).
 */
export const FieldSchema = z.object({
  id: z.string().regex(/^f_r\d_[a-z]+$/),
  name: z.string().min(1),
  /** 사냥터 컨셉 한 줄. 모험 탭 목록에 이름 아래로 보인다 (T17_4) */
  desc: z.string().min(1),
  pool: z.array(z.tuple([z.string(), tier])).min(2),
  /** 6마리 완주 시 확정 드랍. 사냥터마다 다르다 (§4.4). 강화 +6~·보스 버프·반지에 쓴다 */
  material: z.object({ id: z.string().regex(/^mat_/), name: z.string().min(1) }),
});

/** 지역 하나 (§7.2⑤). 티어 대역을 나눠 갖고, 사냥터 7개와 보스 1마리를 가진다. */
export const RegionSchema = z.object({
  id: z.int().min(1).max(REGION_COUNT),
  name: z.string().min(1),
  /** 이 지역을 도는 게 적정한 레벨 구간 */
  levelRange: z.tuple([z.int().min(1), z.int().min(1)]),
  tierBand: z.tuple([tier, tier]),
  /** 지역 단위로 난이도를 한 줄만 고쳐 움직이는 손잡이. 기본 1.0 (§7.2④) */
  difficulty: z.number().positive(),
  town: z.object({ name: z.string().min(1), inn: z.int().min(0) }),
  fields: z.array(FieldSchema).length(FIELDS_PER_REGION),
  /** 다음 지역 해금 조건. 원형의 tiers에 없는 티어를 써도 된다 — 보스는 따로 뽑는다 */
  boss: z.object({
    arch: z.string(),
    tier,
    name: z.string().min(1),
    /**
     * 보스 배율 (T17_5). 원형 power에 곱한다 — HP·ATK·DEF와 보상이 같이 커진다.
     * 지역 끝 레벨 · common 풀세트 · 물약 3개로 **승률 50%** 가 되게 벤치가 잡은 값이다.
     * 지역마다 다른 건 지역 끝에서 플레이어가 몬스터를 앞지른 정도가 지역마다 달라서다.
     */
    mult: z.number().positive(),
  }),
});

export const RegionsSchema = z.array(RegionSchema).nonempty();

export type Field = z.infer<typeof FieldSchema>;
export type Region = z.infer<typeof RegionSchema>;

/** gen-content.ts가 뽑아내는 몬스터 한 마리 (§7.2⑥). */
export const MonsterSchema = z.object({
  id: z.string().regex(/^mon_/),
  name: z.string().min(1),
  region: z.int().min(1).max(REGION_COUNT),
  tier,
  arch: z.string(),
  power: z.number().positive(),
  sprite: z.string().min(1),
  maxHp: z.int().min(1),
  atk: z.number().positive(),
  def: z.number().min(0),
  spd: z.number().positive(),
  cri: z.number().min(0).max(1),
  crd: z.number().positive(),
  eva: z.number().min(0).max(1),
  scale: z.number().positive(),
  exp: z.int().min(1),
  gold: z.int().min(1),
  traits: z.array(z.string().min(1)).nonempty(),
  /** 떨구는 장비 부위 (T17_6). 보스는 없다 — 보스는 부위를 가리지 않고 확정으로 준다 */
  drop: z.enum(GEAR_SLOTS).optional(),
  boss: z.boolean().optional(),
});

export const MonstersSchema = z.array(MonsterSchema).nonempty();

export type Monster = z.infer<typeof MonsterSchema>;

// ─────────────────────────────────────────────────────────────
// 장비 (§4.5, §7.2)
// ─────────────────────────────────────────────────────────────

const slot = z.enum(GEAR_SLOTS);
const rarity = z.enum(RARITIES);

/**
 * 장비 원형 — 부위 하나. 수치는 하나도 없다.
 *
 * 스탯은 §4.5 공식(gearStats)이 전부 뽑고, 여기 있는 건 **이름과 스프라이트뿐**이다.
 * 이름 = `tierNames[티어-1] + names[티어 1이면 0, 아니면 1]` (T17_7 검수 4차) — **등급이 올라도 안 바뀐다.**
 * 그림이 부위 × 티어로만 갈려서, 등급마다 이름을 바꾸면 그림과 이름이 어긋났다. 등급은 색이 말한다.
 */
export const EquipmentArchetypeSchema = z.object({
  slot,
  label: z.string().min(1),
  spriteTag: z.string().min(1),
  /** [티어 1 이름, 티어 2~10 이름] — 낡은 검 → 무쇠 장검 */
  names: z.tuple([z.string().min(1), z.string().min(1)]),
});

export const EquipmentArchetypesSchema = z.object({
  /** 티어 10단계의 재질 이름. 앞에 붙는다 */
  tierNames: z.array(z.string().min(1)).length(GEAR_TIERS),
  slots: z.array(EquipmentArchetypeSchema).length(GEAR_SLOTS.length),
});

/** gen-content.ts가 뽑아내는 장비 정의 하나. 인스턴스가 아니라 **정의**다 (§4.5). */
export const EquipmentSchema = z.object({
  id: z.string().regex(/^eq_t\d+_[a-z]+_[a-z]+$/),
  name: z.string().min(1),
  /** 장비 티어 1~10 */
  tier: z.int().min(1).max(GEAR_TIERS),
  slot,
  rarity,
  /** 착용 요구 레벨 */
  level: z.int().min(1),
  region: z.int().min(1).max(REGION_COUNT),
  sprite: z.string().min(1),
  atk: z.int().min(0),
  maxHp: z.int().min(0),
  def: z.int().min(0),
  /**
   * 1차 스탯 — 장갑 STR · 신발 AGI · 장신구 LUK (T17_7 검수 5차). 포인트처럼 파생 값에 전부 얹힌다.
   * 소수 한 자리 — 정수로 자르면 낮은 티어의 차이가 반올림에 먹힌다 (§4.5)
   */
  str: z.number().min(0),
  agi: z.number().min(0),
  luk: z.number().min(0),
  price: z.int().min(1),
});

export const EquipmentsSchema = z.array(EquipmentSchema).nonempty();

export type EquipmentArchetype = z.infer<typeof EquipmentArchetypeSchema>;
export type Equipment = z.infer<typeof EquipmentSchema>;

/** 물약·엘릭서 (§4.5). 공식이 없는 6줄이라 생성기를 안 만들고 창작물을 그대로 읽는다. */
export const ConsumableSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** 절대값 회복 */
  heal: z.int().min(0),
  /** 최대 HP 대비 회복 (엘릭서). heal과 둘 중 하나만 0이 아니다 */
  healRatio: z.number().min(0).max(1),
  price: z.int().min(1),
  /** 이 지역부터 판다 */
  region: z.int().min(1).max(REGION_COUNT),
});

export const ConsumablesSchema = z.array(ConsumableSchema).nonempty();
export type Consumable = z.infer<typeof ConsumableSchema>;
