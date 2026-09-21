/**
 * 콘텐츠 검증 (§7.4). `npm run validate`
 *
 * 스키마는 원형 하나하나를 보고, 여기서는 **원형끼리의 관계**를 본다 — 중복이 그것이다.
 * 오류를 던지지 않고 모아서 돌려준다. 하나 고치고 다시 돌리는 걸 12번 반복하지 않기 위해서다.
 *
 * T11이 여기에 §7.4의 2·6·7번(참조 무결성 / 밸런스 불변식 / 스프라이트 존재)을 더한다.
 * 그 검사들은 gen-content.ts 산출물이 있어야 볼 게 생기므로 지금은 넣지 않는다.
 */
import raw from '../src/content/archetypes/monsters.json';
import { MonsterArchetypesSchema } from '../src/content/schema';

/** 두 번 이상 나온 값만 골라낸다. */
function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

/**
 * 빈 배열이면 통과. 스키마부터 틀렸으면 스키마 오류만 돌려준다 —
 * 형식이 깨진 데이터에 중복 검사를 돌려봐야 의미 없는 오류만 더 나온다.
 *
 * data를 받는 건 테스트가 일부러 깨진 데이터를 넣어보기 위해서다. T11의 gen-content.ts도
 * 생성 직후 결과물을 파일로 쓰기 전에 이 함수에 통과시킨다.
 */
export function validateContent(data: unknown = raw): string[] {
  const parsed = MonsterArchetypesSchema.safeParse(data);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => `[스키마] ${i.path.join('.') || '(root)'} — ${i.message}`);
  }

  const archetypes = parsed.data;
  const errors: string[] = [];

  // §7.4 #3 — ID 중복 없음
  for (const id of duplicates(archetypes.map((a) => a.id))) {
    errors.push(`[ID 중복] ${id}`);
  }

  // §7.4 #5 — 몬스터 이름 중복 없음. 이름이 곧 강함의 순서라 겹치면 순서가 깨진다 (§7.2②)
  for (const name of duplicates(archetypes.flatMap((a) => a.namePool))) {
    errors.push(`[이름 중복] ${name}`);
  }

  return errors;
}
