/**
 * 콘텐츠 로더 (§7.3). 여기를 통해서만 게임 데이터를 읽는다.
 *
 * 앱이 켜지는 순간 검증하고, 틀렸으면 던진다. 잘못된 데이터로 조용히 도는 것보다
 * 즉시 죽는 게 낫다 — 원인이 몬스터 한 마리가 아니라 JSON 한 줄이기 때문이다.
 * 모든 오류를 한 번에 보고 싶으면 `npm run validate`를 쓴다.
 */
import raw from './archetypes/monsters.json';
import { MonsterArchetypesSchema, type MonsterArchetype } from './schema';

export type { MonsterArchetype };

/** 몬스터 원형 12개 (§7.2). 여기서 몬스터 75종이 나온다 (T11). */
export const MONSTER_ARCHETYPES = MonsterArchetypesSchema.parse(raw);
