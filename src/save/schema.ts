import { z } from 'zod';

/** 세이브 구조를 바꿀 때마다 1씩 올리고 migrations.ts에 변환 한 줄을 추가한다. */
export const SAVE_VERSION = 1;

export const SaveSchema = z.object({
  version: z.literal(SAVE_VERSION),
  player: z.object({
    level: z.int().min(1),
    exp: z.int().min(0),
    gold: z.int().min(0),
    hp: z.int().min(0),
  }),
  stamina: z.object({
    /** 보유 기력 */
    current: z.int().min(0),
    /** 마지막으로 기력으로 바꾼 '오늘 누적 걸음' (증가분만 지급하기 위한 기준선) */
    lastStepTotal: z.int().min(0),
    /** 자정 지급을 한 날짜 'YYYY-MM-DD' (하루 한 번만 주기 위함) */
    lastGrantDate: z.string(),
  }),
});

export type Save = z.infer<typeof SaveSchema>;

export function defaultSave(): Save {
  return {
    version: SAVE_VERSION,
    player: { level: 1, exp: 0, gold: 0, hp: 100 },
    stamina: { current: 0, lastStepTotal: 0, lastGrantDate: '' },
  };
}
