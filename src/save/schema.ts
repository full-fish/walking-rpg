import { z } from 'zod';

/** 세이브 구조를 바꿀 때마다 1씩 올리고 migrations.ts에 변환 한 줄을 추가한다. */
export const SAVE_VERSION = 2;

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
});

export type Save = z.infer<typeof SaveSchema>;

export function defaultSave(): Save {
  return {
    version: SAVE_VERSION,
    player: { level: 1, exp: 0, gold: 0, hp: 100 },
    wp: { current: 0, grantedByDate: {}, lastMidnightGrantAt: '' },
  };
}
