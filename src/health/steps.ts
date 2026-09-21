/**
 * 걸음 계산 규칙. 순수 함수만 둔다 — React/네이티브를 모르므로 Node에서 테스트된다.
 * 네이티브를 부르는 쪽은 useSteps.ts.
 */

/** 소급 지급 범위 — 오늘 포함 최근 3일 (§3.6). 4일 이상 지난 걸음은 소멸. */
export const BACKFILL_DAYS = 3;

/** 'YYYY-MM-DD' → 그날 걸음 수. */
export type DailySteps = Record<string, number>;

/** Health Connect의 일별 집계 한 칸. startTime은 기기 로컬 시각 문자열('2026-09-21T00:00'). */
export type StepGroup = { startTime: string; result: { COUNT_TOTAL?: number } };

/** 로컬 날짜 키. Date.toISOString()은 UTC라 자정 근처에서 하루가 밀린다 — 쓰지 말 것. */
export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** daysAgo일 전의 로컬 자정. */
export function startOfLocalDay(now: Date, daysAgo = 0): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

/** HC 일별 집계 → 날짜별 합계. 같은 날이 두 칸으로 오면 더한다. */
export function toDailyTotals(groups: StepGroup[]): DailySteps {
  const out: DailySteps = {};
  for (const g of groups) {
    const key = g.startTime.slice(0, 10);
    out[key] = (out[key] ?? 0) + Math.max(0, Math.round(g.result.COUNT_TOTAL ?? 0));
  }
  return out;
}

/**
 * 오늘치 = max(HC, 센서기준선 + 실시간, 직전값) (§3.3).
 * HC가 뒤로 가거나 동기화가 늦어도 화면 숫자가 줄어들지 않는다.
 */
export function mergeToday(hcToday: number, sensorToday: number, prevToday = 0): number {
  return Math.max(hcToday, sensorToday, prevToday);
}
