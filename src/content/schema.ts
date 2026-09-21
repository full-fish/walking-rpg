/**
 * 콘텐츠 데이터의 런타임 스키마 (§7.2, §7.4).
 * React를 import하지 않는다 — Node에서 돌아야 한다.
 */
import { z } from 'zod';

import { MAX_TIER } from '../game/formulas';

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
