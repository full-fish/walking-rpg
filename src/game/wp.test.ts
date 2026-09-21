import { expect, test } from 'vitest';

import type { DailySteps } from '../health/steps';
import { MIDNIGHT_WP, regionScaled, WP_COST } from './formulas';
import { grantWp, spendWp, windowKeys, type WpState } from './wp';

const at = (day: number, hour = 10) => new Date(2026, 8, day, hour);

/** 이미 며칠 플레이한 상태 (설치 기준선이 이미 잡혀 있음) */
const playing = (lastDay: number, granted: DailySteps = {}): WpState => ({
  current: 0,
  grantedByDate: granted,
  lastMidnightGrantAt: `2026-09-${String(lastDay).padStart(2, '0')}`,
});

test('창은 오늘 포함 최근 3일, 오래된 것부터', () => {
  expect(windowKeys(at(21))).toEqual(['2026-09-19', '2026-09-20', '2026-09-21']);
});

test('3일 소급 — §3.6 예시 그대로 32,000 WP, 4일 전은 소멸', () => {
  const steps = {
    '2026-09-18': 10_000, // 4일 전 → 소멸
    '2026-09-19': 8_000,
    '2026-09-20': 12_000,
    '2026-09-21': 9_000,
  };
  const r = grantWp(playing(17, { '2026-09-17': 5_000 }), steps, at(21));

  expect(r.fromSteps).toBe(29_000);
  expect(r.fromMidnight).toBe(3 * MIDNIGHT_WP);
  expect(r.granted).toBe(32_000);
  // 창 밖으로 밀려난 기록은 지운다 — 무한히 커지지 않게
  expect(Object.keys(r.state.grantedByDate)).toEqual([
    '2026-09-19',
    '2026-09-20',
    '2026-09-21',
  ]);
});

test('재실행 — 같은 걸음으로 다시 부르면 한 푼도 안 준다', () => {
  const steps = { '2026-09-21': 9_000 };
  const first = grantWp(playing(20), steps, at(21));
  const second = grantWp(first.state, steps, at(21, 14));

  expect(first.granted).toBe(9_000 + MIDNIGHT_WP);
  expect(second.granted).toBe(0);
  expect(second.state.current).toBe(first.state.current);
});

test('중복 지급 — 하루에 여러 번 불러도 증가분만 준다', () => {
  let s = playing(20);
  let total = 0;
  for (const walked of [3_000, 5_000, 5_000, 9_000]) {
    const r = grantWp(s, { '2026-09-21': walked }, at(21));
    s = r.state;
    total += r.granted;
  }
  expect(total).toBe(9_000 + MIDNIGHT_WP);
  expect(s.current).toBe(9_000 + MIDNIGHT_WP);
});

test('걸음 감소 — HC가 뒤로 가도 WP는 깎이지 않는다', () => {
  const first = grantWp(playing(20), { '2026-09-21': 9_000 }, at(21));
  const back = grantWp(first.state, { '2026-09-21': 6_000 }, at(21, 15));

  expect(back.granted).toBe(0);
  expect(back.state.current).toBe(first.state.current);
  // 기록도 높은 쪽을 유지해야 다음에 9,000을 다시 안 준다
  expect(back.state.grantedByDate['2026-09-21']).toBe(9_000);
});

test('자정 경계 — 날이 바뀌면 새 날 걸음 + 자정 1,000을 다시 준다', () => {
  const d21 = grantWp(playing(20), { '2026-09-21': 9_000 }, at(21, 23));
  const d22 = grantWp(d21.state, { '2026-09-21': 9_000, '2026-09-22': 400 }, at(22, 0));

  expect(d22.fromSteps).toBe(400);
  expect(d22.fromMidnight).toBe(MIDNIGHT_WP);
  expect(d22.state.lastMidnightGrantAt).toBe('2026-09-22');
});

test('시계를 뒤로 돌려도 지급되지 않고 기준일도 안 돌아간다', () => {
  const now = grantWp(playing(20), { '2026-09-21': 9_000 }, at(21));
  const back = grantWp(now.state, { '2026-09-20': 12_000, '2026-09-21': 9_000 }, at(20));

  expect(back.fromMidnight).toBe(0);
  expect(back.state.lastMidnightGrantAt).toBe('2026-09-21');
  // 미래 날짜 기록은 남겨야 시계를 되돌렸을 때 재지급되지 않는다
  expect(back.state.grantedByDate['2026-09-21']).toBe(9_000);
});

test('시계를 앞으로 돌렸다 되돌리면 그날 걸음을 다시 주지 않는다', () => {
  const future = grantWp(playing(20), { '2026-10-01': 20_000 }, new Date(2026, 9, 1));
  expect(future.fromSteps).toBe(20_000);

  // 실제 날짜로 복귀 → 10/01 기록이 살아남아 있다가
  const real = grantWp(future.state, { '2026-09-21': 9_000 }, at(21));
  expect(real.fromMidnight).toBe(0); // 이미 10/01까지 받았다
  // 다시 10/01이 와도 0
  const again = grantWp(real.state, { '2026-10-01': 20_000 }, new Date(2026, 9, 1));
  expect(again.fromSteps).toBe(0);
});

test('설치 직후 — 그동안의 걸음은 안 주고 오늘 자정 지급만 준다 (§5.4)', () => {
  const fresh: WpState = { current: 0, grantedByDate: {}, lastMidnightGrantAt: '' };
  const r = grantWp(fresh, { '2026-09-19': 8_000, '2026-09-20': 12_000, '2026-09-21': 6_000 }, at(21));

  expect(r.fromSteps).toBe(0);
  expect(r.granted).toBe(MIDNIGHT_WP);
  // 설치 후 더 걸은 만큼은 정상 지급
  expect(grantWp(r.state, { '2026-09-21': 6_500 }, at(21, 18)).granted).toBe(500);
});

test('한 발도 안 걸은 날에도 1,000 WP는 들어온다 (§4.1)', () => {
  expect(grantWp(playing(20), {}, at(21)).granted).toBe(MIDNIGHT_WP);
});

test('WP는 모자라면 안 쓰이고 null을 준다', () => {
  const wallet: WpState = { current: 1_500, grantedByDate: {}, lastMidnightGrantAt: '2026-09-21' };
  expect(spendWp(wallet, WP_COST.bossFirst(1))).toBeNull(); // 10,000 — 모자람
  expect(spendWp(wallet, WP_COST.fieldEntry(1))?.current).toBe(300);
  expect(spendWp(wallet, 1_500)?.current).toBe(0); // 딱 맞으면 쓸 수 있다
  expect(() => spendWp(wallet, -1)).toThrow(/잘못된 WP 비용/);
});

test('지역 스케일 비용이 §4.1 표와 맞는다', () => {
  expect([1, 2, 3, 4, 5].map((r) => WP_COST.fieldEntry(r))).toEqual([
    1_200, 1_320, 1_452, 1_597, 1_757,
  ]);
  expect(WP_COST.bossFirst(5)).toBe(14_641);
  expect(WP_COST.regionUnlock(3)).toBe(12_100);
  expect(regionScaled(3_000, 4)).toBe(3_993);
});
