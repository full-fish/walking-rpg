import { BACKFILL_DAYS, dayKey, startOfLocalDay } from '../health/steps';
import type { DailySteps } from '../health/steps';
import type { Save } from '../save/schema';
import { MIDNIGHT_WP } from './formulas';

/** 세이브의 wp 조각. 스키마가 원본이라 여기서 다시 정의하지 않는다. */
export type WpState = Save['wp'];

export type GrantResult = {
  state: WpState;
  /** 이번에 지급된 총 WP */
  granted: number;
  /** 그중 걸음에서 온 몫 */
  fromSteps: number;
  /** 그중 자정 기본 지급에서 온 몫 */
  fromMidnight: number;
};

/** 오늘 포함 최근 BACKFILL_DAYS일의 날짜 키. 오래된 것부터. */
export function windowKeys(now: Date): string[] {
  const keys: string[] = [];
  for (let i = BACKFILL_DAYS - 1; i >= 0; i--) keys.push(dayKey(startOfLocalDay(now, i)));
  return keys;
}

/**
 * 설치 직후 1회. 지금까지의 걸음을 '이미 지급한 것'으로 찍어 소급을 막는다 (§5.4).
 * 자정 지급은 오늘 것부터 받아야 하므로 어제까지 준 것으로 표시한다.
 */
function seedInstall(state: WpState, steps: DailySteps, now: Date): WpState {
  const grantedByDate: Record<string, number> = {};
  for (const key of windowKeys(now)) grantedByDate[key] = Math.max(0, steps[key] ?? 0);
  return { ...state, grantedByDate, lastMidnightGrantAt: dayKey(startOfLocalDay(now, 1)) };
}

/**
 * 걸음과 자정 기본 지급을 WP로 바꾼다 (§3.6, §4.1).
 *
 * - 최근 3일(오늘 포함)만 본다. 4일 이상 지난 날짜는 기록에서 지운다.
 * - 날짜별로 max(0, 그날 걸음 - 그날 이미 지급분)만 더한다 → 몇 번 불러도 중복 지급 없음.
 * - HC가 뒤로 가도 WP는 깎이지 않는다.
 * - 자정 1,000은 날짜별 1회. 미접속일도 창 안이면 소급된다.
 *
 * 시계를 앞으로 돌렸다가 되돌리면 미래 날짜 기록이 남아 재지급을 막는다.
 * ponytail: 시계를 계속 앞으로 밀면 창 하나씩 더 받을 수 있다. 글로벌 랭킹이 없어
 * 방치했다(§3.2). 서버 검증을 넣게 되면 그때 막는다.
 */
export function grantWp(state: WpState, steps: DailySteps, now: Date): GrantResult {
  const base = state.lastMidnightGrantAt === '' ? seedInstall(state, steps, now) : state;
  const keys = windowKeys(now);
  const today = keys[keys.length - 1];

  // 창 밖으로 밀려난 옛 날짜만 버린다. 미래 날짜는 재지급 방지용으로 남긴다.
  const grantedByDate: Record<string, number> = {};
  for (const [date, count] of Object.entries(base.grantedByDate)) {
    if (date >= keys[0]) grantedByDate[date] = count;
  }

  let fromSteps = 0;
  for (const date of keys) {
    const walked = Math.max(0, Math.floor(steps[date] ?? 0));
    const already = grantedByDate[date] ?? 0;
    fromSteps += Math.max(0, walked - already);
    grantedByDate[date] = Math.max(already, walked);
  }

  let fromMidnight = 0;
  for (const date of keys) {
    if (date > base.lastMidnightGrantAt) fromMidnight += MIDNIGHT_WP;
  }
  // 시계를 뒤로 돌려도 기준일이 되돌아가지 않게 한다.
  const lastMidnightGrantAt =
    today > base.lastMidnightGrantAt ? today : base.lastMidnightGrantAt;

  const granted = fromSteps + fromMidnight;
  return {
    state: { current: base.current + granted, grantedByDate, lastMidnightGrantAt },
    granted,
    fromSteps,
    fromMidnight,
  };
}

/** WP를 쓴다. 모자라면 null — 호출부가 반드시 확인하게 강제한다. */
export function spendWp(state: WpState, cost: number): WpState | null {
  if (!Number.isInteger(cost) || cost < 0) throw new Error(`잘못된 WP 비용: ${cost}`);
  if (state.current < cost) return null;
  return { ...state, current: state.current - cost };
}
