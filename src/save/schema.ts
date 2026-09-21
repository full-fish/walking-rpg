import { z } from 'zod';

import { ENHANCE_MAX, GEAR_SLOTS, QUALITY_MAX, QUALITY_MIN } from '../game/formulas';

/** 세이브 구조를 바꿀 때마다 1씩 올리고 migrations.ts에 변환 한 줄을 추가한다. */
export const SAVE_VERSION = 4;

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
    regionProgress: { current: 1, unlocked: 1 },
  };
}
