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
  })
  .refine((a) => a.tiers.length === a.namePool.length, {
    error: 'tiers와 namePool의 길이가 같아야 한다 (§7.4 #4)',
    path: ['namePool'],
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
  pool: z.array(z.tuple([z.string(), tier])).min(2),
  /** 6마리 완주 시 확정 드랍. 사냥터마다 다르다 (§4.4) */
  material: z.object({ id: z.string().regex(/^mat_/), name: z.string().min(1) }),
  /** 그 소재로만 바꿀 수 있는 전용 장비 (§4.5). 성능 계산은 T13 */
  reward: z.object({
    id: z.string().regex(/^uniq_/),
    name: z.string().min(1),
    cost: z.object({ material: z.int().min(1), gold: z.int().min(0) }),
  }),
});

/** 지역 하나 (§7.2⑤). 티어 대역을 나눠 갖고, 사냥터 5개와 보스 1마리를 가진다. */
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
  boss: z.object({ arch: z.string(), tier, name: z.string().min(1) }),
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
 * 이름 = `tierNames[티어-1] + namePool[등급]` — 10티어 × 6부위 × 5등급 = 300종이 겹치지 않는다.
 */
export const EquipmentArchetypeSchema = z.object({
  slot,
  label: z.string().min(1),
  spriteTag: z.string().min(1),
  namePool: z.record(rarity, z.string().min(1)),
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
  /** 소수 한 자리. 정수로 자르면 낮은 티어 신발이 통째로 0이 된다 (§4.5) */
  spd: z.number().min(0),
  price: z.int().min(1),
});

export const EquipmentsSchema = z.array(EquipmentSchema).nonempty();

export type EquipmentArchetype = z.infer<typeof EquipmentArchetypeSchema>;
export type Equipment = z.infer<typeof EquipmentSchema>;
