import { z } from 'zod';

import {
  BAG,
  BUFF_STATS,
  ENHANCE_MAX,
  GEAR_SLOTS,
  QUALITY_MAX,
  QUALITY_MIN,
  RARITIES,
  REGION_COUNT,
  RING_KINDS,
  RING_SLOTS,
  VAULT,
} from '../game/formulas';

/** 세이브 구조를 바꿀 때마다 1씩 올리고 migrations.ts에 변환 한 줄을 추가한다. */
export const SAVE_VERSION = 11;

/**
 * 장비 **한 개체** (§4.5). 정의 ID가 아니라 이걸 저장한다 —
 * 같은 "강철 대검"이라도 품질과 강화가 달라서 개체마다 스탯이 다르기 때문이다.
 */
export const ItemInstanceSchema = z.object({
  /** 세이브 안에서만 유일하면 된다. items.ts가 1부터 세어 붙인다 */
  uid: z.string().min(1),
  /** data/items/equipment.json의 id */
  defId: z.string().min(1),
  quality: z.number().min(QUALITY_MIN).max(QUALITY_MAX),
  enhance: z.int().min(0).max(ENHANCE_MAX),
});

export type ItemInstance = z.infer<typeof ItemInstanceSchema>;

/**
 * 반지 하나 (T17_7). 장비 정의(defId)가 없다 — 효과·★·등급·강화가 전부다.
 * ★는 그 반지를 올리는 소재의 지역이다. 품질은 없다 — 소재로 만든 물건이라 굴릴 게 없다.
 */
export const RingSchema = z.object({
  uid: z.string().min(1),
  kind: z.enum(RING_KINDS),
  tier: z.int().min(1).max(REGION_COUNT),
  rarity: z.enum(RARITIES),
  enhance: z.int().min(0).max(ENHANCE_MAX),
});

export type Ring = z.infer<typeof RingSchema>;

export const SaveSchema = z.object({
  version: z.literal(SAVE_VERSION),
  player: z.object({
    level: z.int().min(1),
    exp: z.int().min(0),
    gold: z.int().min(0),
    hp: z.int().min(0),
  }),
  wp: z.object({
    /** 보유 WP. 상한 없음 (§4.1) */
    current: z.int().min(0),
    /**
     * 'YYYY-MM-DD' → 그날 이미 지급한 걸음 수. 중복 지급을 막는 기록 (§3.6).
     * 최근 3일(오늘 포함)치만 남기고 grantWp()가 정리한다.
     */
    grantedByDate: z.record(z.string(), z.int().min(0)),
    /** 자정 1,000을 마지막으로 지급한 날짜 'YYYY-MM-DD'. ''이면 설치 직후 */
    lastMidnightGrantAt: z.string(),
  }),
  /** HP 자연회복을 마지막으로 반영한 시각(epoch ms). 10분당 1% (§4.2) */
  hpUpdatedAt: z.int().min(0),
  /** 1차 스탯 배분. 레벨당 3포인트를 받아 unspent에 쌓인다 (§4.3) */
  statPoints: z.object({
    unspent: z.int().min(0),
    str: z.int().min(0),
    vit: z.int().min(0),
    agi: z.int().min(0),
    luk: z.int().min(0),
    /** T18 전까지는 0에서 안 움직인다 — 배분 대상이 아니다 (§4.3) */
    int: z.int().min(0),
  }),
  /** 가진 장비 개체 전부 (§4.5) */
  inventory: z.array(ItemInstanceSchema),
  /** 부위별로 낀 개체의 uid. 빈 칸은 null (§4.5) */
  equipped: z.record(z.enum(GEAR_SLOTS), z.string().nullable()),
  /** 가진 반지 (T17_7). 가방 칸을 안 쓴다 */
  rings: z.array(RingSchema),
  /** 반지 칸 두 개에 낀 반지의 uid. 빈 칸은 null (T17_7) */
  ringSlots: z.array(z.string().nullable()).length(RING_SLOTS),
  /**
   * 창고 (§3.7). **한도가 진짜 제약**이라 넘치는 만큼은 들고 다녀야 하고,
   * 죽으면 그중 10%를 잃는다. 여기 넣은 골드는 사망해도 면제다.
   */
  vault: z.object({
    gold: z.int().min(0),
    capacity: z.int().min(0),
    expansions: z.int().min(0).max(VAULT.maxExpansions),
  }),
  /** 가방 칸 수 (§4.5, T17_2). **낀 장비는 안 센다.** 상점에서 늘린다 */
  bag: z.object({
    capacity: z.int().min(1),
    expansions: z.int().min(0).max(BAG.maxExpansions),
  }),
  /** 사냥터 고유 소재 — fieldId → 개수 (§4.4). 실제 드랍은 T16 */
  materials: z.record(z.string(), z.int().min(0)),
  /** 물약·엘릭서 — id → 개수 (§4.5). 사냥터에 들고 가는 건 최대 3개 (§4.4) */
  consumables: z.record(z.string(), z.int().min(0)),
  /**
   * 진행 중인 사냥터 한 판 (§4.4). **null이면 마을에 있다** —
   * 창고·여관·상점이 이걸로 "마을에서만"을 판단한다.
   */
  run: z
    .object({
      fieldId: z.string().min(1),
      /**
       * 입장할 때 뽑은 마릿수 2~6 (§4.4). **보스전은 1이다** (T17_5) — 2부터로 막혀 있어서
       * 보스전 중에 앱이 꺼지면 다음 실행에서 세이브를 못 읽고 새 게임으로 시작했다.
       * **화면에 절대 보여주지 않는다.** 알면 도박이 아니라 계산이 된다.
       */
      size: z.int().min(1).max(6),
      /** 지금까지 잡은 수. 이건 보여준다 ("N번째 처치") */
      killed: z.int().min(0),
      /** 이 판에서 받은 개별 보상 합. 클리어 보너스를 여기에 비례해 준다 */
      earned: z.object({ exp: z.int().min(0), gold: z.int().min(0) }),
      /** 들고 들어온 물약 — id → 남은 개수. 안에서는 이것만 쓴다 */
      potions: z.record(z.string(), z.int().min(0)),
      /** 지금 상대할 몬스터. 세이브에 둬야 전투 중에 앱이 꺼져도 이어진다 */
      monsterId: z.string().min(1),
      /**
       * 보스전인가 (T17_5). 보스는 몰이사냥이 아니라 1:1이라 size 1짜리 판으로 돈다 —
       * 물약 휴대 · 전투 중 물약 · 앱 재시작 복구를 사냥터와 똑같이 얻는다.
       * 이때 fieldId는 사냥터가 아니라 `boss_r{지역}`이다.
       */
      boss: z.boolean(),
      /**
       * 소재 버프 (T17_6 검수) — 판 안에서 소재 하나에 하나씩 뽑은 전투력 값. statsOf가 그 판에만
       * ×1.1씩 곱한다. 같은 게 두 번이면 두 번 곱한다. 사냥터 판도 쓴다 (T17_7 검수 5차 — 모양은 그대로라 마이그레이션 없음).
       */
      buffs: z.array(z.enum(BUFF_STATS)),
    })
    .nullable(),
  /** 지역 진행도 (§4.1, T17_5). 해금 = 그 지역 보스 처치 + 해금 비용. 이동은 따로 낸다 */
  regionProgress: z.object({
    /** 지금 있는 지역 */
    current: z.int().min(1),
    /** 해금된 가장 높은 지역 */
    unlocked: z.int().min(1),
    /**
     * 지역 번호 → 보스 기록. 없으면 아직 안 싸웠다(첫 도전 값), tried면 재도전 값,
     * cleared면 잡았다 — 다음 지역을 해금할 수 있다.
     */
    bosses: z.record(z.string(), z.enum(['tried', 'cleared'])),
  }),
});

export type Save = z.infer<typeof SaveSchema>;

export function defaultSave(): Save {
  return {
    version: SAVE_VERSION,
    player: { level: 1, exp: 0, gold: 0, hp: 100 },
    wp: { current: 0, grantedByDate: {}, lastMidnightGrantAt: '' },
    hpUpdatedAt: 0,
    statPoints: { unspent: 0, str: 0, vit: 0, agi: 0, luk: 0, int: 0 },
    inventory: [],
    equipped: Object.fromEntries(GEAR_SLOTS.map((s) => [s, null])) as Save['equipped'],
    rings: [],
    ringSlots: Array.from({ length: RING_SLOTS }, () => null),
    vault: { gold: 0, capacity: VAULT.capacity, expansions: 0 },
    bag: { capacity: BAG.capacity, expansions: 0 },
    materials: {},
    consumables: {},
    run: null,
    regionProgress: { current: 1, unlocked: 1, bosses: {} },
  };
}
