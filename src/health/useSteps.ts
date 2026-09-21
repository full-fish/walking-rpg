import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /**
   * 'YYYY-MM-DD' → 그날 걸음. 오늘 포함 최근 3일. WP 지급(T5)이 그대로 받아 쓴다.
   * 오늘치는 센서 보정이 끝난 today로 덮어 내보낸다 — HC가 없어도 걸은 만큼 WP가 된다.
   */
  byDate: DailySteps;
  status: StepsStatus;
  /** 보조 수단. 안 눌러도 자동으로 갱신된다 */
  refresh: () => void;
  /** 안내 화면의 [연결] 버튼용. 센서 권한과 HC 권한을 둘 다 다시 요청한다 */
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
  /** 지금 구독 중인 센서. 이미 있으면 ensureSensor가 다시 구독하지 않는다. */
  const pedometerSub = useRef<{ remove: () => void } | undefined>(undefined);

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

  // 센서 권한을 확보하고 구독한다. 이미 구독 중이면 아무것도 하지 않는다.
  // 첫 마운트와 [연결] 버튼(connect) 둘 다 이 함수 하나로 들어온다 — 버튼을 눌러도
  // 센서 권한은 재요청 안 되던 문제(실기기 확인)의 원인이 "로직이 두 곳에 따로" 있었던 것이라
  // 하나로 합쳤다.
  const ensureSensor = useCallback(async () => {
    if (pedometerSub.current) return;
    try {
      if (!(await Pedometer.isAvailableAsync())) {
        setStatus((s) => (s === 'connected' ? s : 'unavailable'));
        return;
      }
      const perm = await Pedometer.requestPermissionsAsync();
      if (!perm.granted) return;
      pedometerSub.current = Pedometer.watchStepCount(({ steps }) => {
        liveRef.current = steps;
        setLive(steps);
      });
    } catch (e) {
      console.warn('[steps] 센서 권한 요청 실패 — Health Connect 값만 씁니다.', e);
    }
  }, []);

  // 초기화: 센서 권한 → HC 권한 → 포그라운드 복귀 + 60초 폴링.
  //
  // 센서 권한(ACTIVITY_RECOGNITION)과 HC 권한은 둘 다 "액티비티 결과"로 응답받는
  // 시스템 창이라, 동시에 요청하면 안드로이드가 하나를 화면에 띄우지도 않고 조용히
  // 묵살한다(실기기 확인: HC 창만 뜨고 센서 권한 창이 아예 안 뜸). 한쪽이 완전히
  // 끝난 뒤 다음 걸 요청해야 한다.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureSensor();
      if (cancelled) return;
      try {
        if ((await prepare()) && !(await hasPermission())) await requestPermission([READ_STEPS]);
      } catch (e) {
        console.warn('[steps] Health Connect 권한 요청 실패', e);
      }
      if (!cancelled) refresh();
    })();

    const timer = setInterval(refresh, POLL_MS);
    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => {
      cancelled = true;
      pedometerSub.current?.remove();
      pedometerSub.current = undefined;
      clearInterval(timer);
      appStateSub.remove();
    };
  }, [ensureSensor, refresh]);

  // HC든 센서든 값이 움직이면 오늘치를 다시 접는다.
  useEffect(() => {
    const hcToday = byDate[dayKey(new Date())] ?? 0;
    const sensorToday = (baseline.current ?? 0) + (live - liveBase.current);
    setToday((prev) => mergeToday(hcToday, sensorToday, prev));
  }, [byDate, live]);

  const connect = useCallback(() => {
    void (async () => {
      // 거부했던 두 권한을 순서대로 다시 물어본다(동시 요청 금지 이유는 위 주석 참고).
      // 안드로이드가 "다시 묻지 않음"으로 기억해뒀으면 창 없이 바로 거부로 돌아온다 —
      // 그 경우 앱에서 더 할 수 있는 건 없고 사용자가 시스템 설정에서 직접 켜야 한다.
      await ensureSensor();
      try {
        if (await prepare()) await requestPermission([READ_STEPS]);
      } catch (e) {
        console.warn('[steps] Health Connect 권한 요청 실패', e);
      }
      refresh();
    })();
  }, [ensureSensor, refresh]);

  // HC는 오늘치를 늦게 반영하고, 센서만 쓰는 폰은 아예 안 준다.
  // 호출부가 매번 합치다 빠뜨리지 않도록 여기서 한 번만 덮어쓴다.
  const merged = useMemo(() => ({ ...byDate, [dayKey(new Date())]: today }), [byDate, today]);

  return { today, byDate: merged, status, refresh, connect };
}
