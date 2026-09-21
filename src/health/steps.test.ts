import { expect, test } from 'vitest';

import { dayKey, mergeToday, startOfLocalDay, toDailyTotals } from './steps';

test('날짜 키는 UTC가 아니라 로컬 날짜를 쓴다', () => {
  // 로컬 23시. toISOString()이면 다음 날로 밀리는 시각.
  const d = new Date(2026, 8, 21, 23, 30);
  expect(dayKey(d)).toBe('2026-09-21');
});

test('startOfLocalDay는 자정으로 자르고 날짜를 뺀다', () => {
  const now = new Date(2026, 8, 21, 14, 5, 30);
  expect(dayKey(startOfLocalDay(now))).toBe('2026-09-21');
  expect(dayKey(startOfLocalDay(now, 2))).toBe('2026-09-19');
  expect(startOfLocalDay(now).getHours()).toBe(0);
});

test('HC 일별 집계를 날짜별 합계로 접는다', () => {
  expect(
    toDailyTotals([
      { startTime: '2026-09-19T00:00', result: { COUNT_TOTAL: 8000 } },
      { startTime: '2026-09-20T00:00', result: { COUNT_TOTAL: 12000 } },
      { startTime: '2026-09-20T12:00', result: { COUNT_TOTAL: 500 } },
      { startTime: '2026-09-21T00:00', result: {} },
    ]),
  ).toEqual({ '2026-09-19': 8000, '2026-09-20': 12500, '2026-09-21': 0 });
});

test('오늘치는 셋 중 최대 — 절대 줄지 않는다', () => {
  expect(mergeToday(5000, 300, 0)).toBe(5000); // HC가 앞섬(워치 걸음)
  expect(mergeToday(0, 300, 0)).toBe(300); // HC 미동기화 → 센서로 즉시 반영
  expect(mergeToday(4800, 300, 5000)).toBe(5000); // HC가 뒤로 가도 유지
});
