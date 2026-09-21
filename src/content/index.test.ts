import { expect, test } from 'vitest';

import {
  MONSTER_ARCHETYPES,
  MONSTERS,
  REGIONS,
  monstersOfField,
  regionById,
  tierForLevel,
} from './index';

/**
 * 앱이 켜질 때 타는 경로 그대로다 — import만 해도 스키마 검증이 돈다.
 * 내용 검증은 `npm run validate`가 하고, 여기서는 "로더가 살아 있나"만 본다.
 */
test('로더 — 원형 12개와 지역 데이터가 파싱된다 (§7.2)', () => {
  expect(MONSTER_ARCHETYPES).toHaveLength(12);
  expect(REGIONS).toHaveLength(2);
  expect(MONSTERS.length).toBeGreaterThan(30);
  expect(regionById(1).fields).toHaveLength(5);
});

test('사냥터 풀이 실제 몬스터로 풀린다', () => {
  for (const region of REGIONS) {
    for (const field of region.fields) {
      const pool = monstersOfField(field);
      expect(pool).toHaveLength(field.pool.length);
      // 그 지역 티어 대역 안의 일반 몬스터여야 한다
      for (const m of pool) {
        expect(m.boss).toBeUndefined();
        expect(m.tier).toBeGreaterThanOrEqual(region.tierBand[0]);
        expect(m.tier).toBeLessThanOrEqual(region.tierBand[1]);
      }
    }
  }
});

test('적정 티어는 레벨과 같지 않다 — 지역이 레벨 구간을 티어 대역에 눕힌다', () => {
  // 지역 1은 Lv1~8에 티어 1~5. 레벨 2개에 티어 1개꼴이다
  expect(tierForLevel(1)).toBe(1);
  expect(tierForLevel(8)).toBe(5);
  expect(tierForLevel(16)).toBe(10);

  // 레벨이 오르면 티어도 내려가지 않는다
  for (let level = 2; level <= 20; level++) {
    expect(tierForLevel(level)).toBeGreaterThanOrEqual(tierForLevel(level - 1));
  }
});
