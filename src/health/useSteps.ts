import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  aggregateGroupByPeriod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

import { BACKFILL_DAYS, dayKey, mergeToday, startOfLocalDay, toDailyTotals } from './steps';
import type { DailySteps } from './steps';

/** 앱이 열려 있는 동안 자동 재조회 주기. HC 읽기는 로컬 DB 쿼리라 비용이 거의 없다 (§3.3). */
const POLL_MS = 60_000;

const READ_STEPS = { accessType: 'read', recordType: 'Steps' } as const;

export type StepsStatus =
  /** HC 연결됨. 3일 소급 가능 */
  | 'connected'
  /** HC 없음/거부. 센서만 — 오늘치만, 소급 불가 (§5.4) */
  | 'sensor-only'
  /** 걸음을 셀 방법이 없음 */
  | 'unavailable';

export type Steps = {
  /** 오늘 걸음. max(HC, 센서) — 절대 줄지 않는다 */
  today: number;
  /** 'YYYY-MM-DD' → 그날 걸음. 오늘 포함 최근 3일. T5가 지급에 쓴다 */
  byDate: DailySteps;
  status: StepsStatus;
  /** 보조 수단. 안 눌러도 자동으로 갱신된다 */
  refresh: () => void;
  /** 안내 화면의 [연결] 버튼용. HC 권한 재요청 */
  connect: () => void;
};

/** HC 권한이 이미 있는지. 없으면 false — 던지지 않는다. */
async function hasPermission(): Promise<boolean> {
  const granted = await getGrantedPermissions();
  return granted.some(
    (p) => p.recordType === READ_STEPS.recordType && p.accessType === READ_STEPS.accessType,
  );
}

/** HC를 쓸 수 있으면 준비시키고 true. 미설치·미지원이면 false. */
async function prepare(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return (await getSdkStatus()) === SdkAvailabilityStatus.SDK_AVAILABLE && (await initialize());
}

/** 최근 3일 일별 걸음. 읽을 수 없으면 null (미설치/권한거부/오류) — 앱은 계속 돈다. */
async function readRecent(now: Date): Promise<DailySteps | null> {
  try {
    if (!(await prepare()) || !(await hasPermission())) return null;
    const groups = await aggregateGroupByPeriod({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfLocalDay(now, BACKFILL_DAYS - 1).toISOString(),
        endTime: now.toISOString(),
      },
      timeRangeSlicer: { period: 'DAYS', length: 1 },
    });
    return toDailyTotals(groups);
  } catch (e) {
    console.warn('[steps] Health Connect 읽기 실패 — 센서로 계속합니다.', e);
    return null;
  }
}

/**
 * 오늘 걸음을 자동으로 따라간다.
 * 포그라운드 복귀 + 60초 폴링으로 HC를 읽고, 열려 있는 동안엔 센서가 실시간으로 올린다 (§5.4).
 */
export function useSteps(): Steps {
  const [today, setToday] = useState(0);
  const [byDate, setByDate] = useState<DailySteps>({});
  const [live, setLive] = useState(0);
  const [status, setStatus] = useState<StepsStatus>('sensor-only');

  /** watchStepCount는 구독 시점부터의 누적. 폴링 콜백에서 최신값을 읽으려고 ref로도 둔다. */
  const liveRef = useRef(0);
  /** 자정을 넘기면 여기까지를 어제 몫으로 잘라낸다. */
  const liveBase = useRef(0);
  /** 센서 누적에 더할 기준선 = 센서가 0일 때의 HC 오늘치. */
  const baseline = useRef<number | null>(null);
  const dayRef = useRef(dayKey(new Date()));

  const refresh = useCallback(() => {
    const now = new Date();
    const key = dayKey(now);
    if (key !== dayRef.current) {
      // 자정 통과: 오늘치를 0부터 다시 센다.
      dayRef.current = key;
      liveBase.current = liveRef.current;
      baseline.current = null;
      setToday(0);
    }
    void readRecent(now).then((daily) => {
      if (!daily) {
        setStatus((s) => (s === 'connected' ? 'sensor-only' : s));
        return;
      }
      setStatus('connected');
      setByDate(daily);
      if (baseline.current === null && liveRef.current === liveBase.current) {
        baseline.current = daily[key] ?? 0;
      }
    });
  }, []);

  // 센서 실시간 구독. 권한이 없거나 센서가 없으면 조용히 건너뛴다.
  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    let cancelled = false;
    void (async () => {
      try {
        if (!(await Pedometer.isAvailableAsync())) {
          if (!cancelled) setStatus((s) => (s === 'connected' ? s : 'unavailable'));
          return;
        }
        const perm = await Pedometer.requestPermissionsAsync();
        if (!perm.granted || cancelled) return;
        sub = Pedometer.watchStepCount(({ steps }) => {
          liveRef.current = steps;
          setLive(steps);
        });
      } catch (e) {
        console.warn('[steps] 센서 구독 실패 — Health Connect 값만 씁니다.', e);
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  // 첫 실행에서 HC 권한을 한 번 물어본 뒤, 포그라운드 복귀 + 60초마다 자동으로 읽는다.
  useEffect(() => {
    void (async () => {
      try {
        if ((await prepare()) && !(await hasPermission())) await requestPermission([READ_STEPS]);
      } catch (e) {
        console.warn('[steps] Health Connect 권한 요청 실패', e);
      }
      refresh();
    })();
    const timer = setInterval(refresh, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  // HC든 센서든 값이 움직이면 오늘치를 다시 접는다.
  useEffect(() => {
    const hcToday = byDate[dayKey(new Date())] ?? 0;
    const sensorToday = (baseline.current ?? 0) + (live - liveBase.current);
    setToday((prev) => mergeToday(hcToday, sensorToday, prev));
  }, [byDate, live]);

  const connect = useCallback(() => {
    void (async () => {
      try {
        if (await prepare()) await requestPermission([READ_STEPS]);
      } catch (e) {
        console.warn('[steps] Health Connect 권한 요청 실패', e);
      }
      refresh();
    })();
  }, [refresh]);

  return { today, byDate, status, refresh, connect };
}
