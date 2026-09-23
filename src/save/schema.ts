import { z } from 'zod';

import { BAG, ENHANCE_MAX, GEAR_SLOTS, QUALITY_MAX, QUALITY_MIN, VAULT } from '../game/formulas';

/** 세이브 구조를 바꿀 때마다 1씩 올리고 migrations.ts에 변환 한 줄을 추가한다. */
export const SAVE_VERSION = 8;

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
       * 입장할 때 뽑은 마릿수 2~6 (§4.4).
       * **화면에 절대 보여주지 않는다.** 알면 도박이 아니라 계산이 된다.
       */
      size: z.int().min(2).max(6),
      /** 지금까지 잡은 수. 이건 보여준다 ("N번째 처치") */
      killed: z.int().min(0),
      /** 이 판에서 받은 개별 보상 합. 클리어 보너스를 여기에 비례해 준다 */
      earned: z.object({ exp: z.int().min(0), gold: z.int().min(0) }),
      /** 들고 들어온 물약 — id → 남은 개수. 안에서는 이것만 쓴다 */
      potions: z.record(z.string(), z.int().min(0)),
      /** 지금 상대할 몬스터. 세이브에 둬야 전투 중에 앱이 꺼져도 이어진다 */
      monsterId: z.string().min(1),
    })
    .nullable(),
  /** 지역 진행도 (§4.1). 해금은 보스 클리어 + 해금 비용 — 실제 해금은 T17 이후 */
  regionProgress: z.object({
    /** 지금 있는 지역 */
    current: z.int().min(1),
    /** 해금된 가장 높은 지역 */
    unlocked: z.int().min(1),
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
    vault: { gold: 0, capacity: VAULT.capacity, expansions: 0 },
    bag: { capacity: BAG.capacity, expansions: 0 },
    materials: {},
    consumables: {},
    run: null,
    regionProgress: { current: 1, unlocked: 1 },
  };
}
