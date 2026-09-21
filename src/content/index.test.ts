import { expect, test } from 'vitest';

import { MONSTER_ARCHETYPES } from './index';

/**
 * 앱이 켜질 때 타는 경로 그대로다 — import만 해도 스키마 검증이 돈다.
 * 내용 검증은 `npm run validate`가 하고, 여기서는 "로더가 살아 있나"만 본다.
 */
test('원형 로더 — 12개가 파싱된다 (§7.2)', () => {
  expect(MONSTER_ARCHETYPES).toHaveLength(12);
  expect(MONSTER_ARCHETYPES[0].id).toMatch(/^arch_/);
});
