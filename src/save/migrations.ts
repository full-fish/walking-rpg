import { BAG, GEAR_SLOTS, POINTS_PER_LEVEL, VAULT } from '../game/formulas';
import { SAVE_VERSION } from './schema';

/** vN 세이브를 v(N+1) 모양으로 바꾼다. version 필드는 migrate()가 알아서 올린다. */
type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/**
 * 버전별 변환 체인. 스키마를 바꿀 때 SAVE_VERSION을 올리고 여기에 한 줄 추가한다.
 */
export const migrations: Record<number, Migration> = {
  /** v1 stamina{current,lastStepTotal,lastGrantDate} → v2 wp{current,grantedByDate,lastMidnightGrantAt} */
  1: (s) => {
    const old = (s.stamina ?? {}) as {
      current?: number;
      lastStepTotal?: number;
      lastGrantDate?: string;
    };
    const date = old.lastGrantDate ?? '';
    const next: Record<string, unknown> = {
      ...s,
      wp: {
        current: old.current ?? 0,
        // 이미 WP로 바꾼 걸음은 다시 주지 않는다
        grantedByDate: date ? { [date]: old.lastStepTotal ?? 0 } : {},
        lastMidnightGrantAt: date,
      },
    };
    delete next.stamina;
    return next;
  },

  /** v2 → v3: HP 자연회복 기준 시각, 스탯 배분, 지역 진행도 추가 */
  2: (s) => {
    const level = ((s.player ?? {}) as { level?: number }).level ?? 1;
    return {
      ...s,
      // 지금부터 회복을 센다. 0으로 두면 첫 로드에서 24시간치가 한 번에 들어온다.
      hpUpdatedAt: Date.now(),
      // 지금까지 올린 레벨만큼 배분 포인트를 소급해서 준다.
      statPoints: {
        unspent: Math.max(0, level - 1) * POINTS_PER_LEVEL,
        str: 0,
        vit: 0,
        agi: 0,
        luk: 0,
      },
      regionProgress: { current: 1, unlocked: 1 },
    };
  },

  /** v3 → v4: 인벤토리·장착 칸, 그리고 INT (§4.5, §4.3) */
  3: (s) => {
    const points = (s.statPoints ?? {}) as Record<string, number>;
    return {
      ...s,
      // INT는 직업 시작값으로만 들어오므로 배분분은 0에서 시작한다
      statPoints: { ...points, int: 0 },
      inventory: [],
      equipped: Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, null])),
    };
  },

  /** v4 → v5: 창고·소재·소모품 (§3.7, §4.5) */
  4: (s) => ({
    ...s,
    vault: { gold: 0, capacity: VAULT.capacity, expansions: 0 },
    materials: {},
    consumables: {},
  }),

  /** v5 → v6: 진행 중인 판 (§4.4). 업데이트한 순간 사냥터 밖이므로 null이다 */
  5: (s) => ({ ...s, run: null }),

  /**
   * v6 → v7: 가방 칸 수 (§4.5, T17_2).
   * 전에는 60칸이 공짜였으니 **이미 가진 것은 그대로 들고 있게** 기본 20과 비교해 큰 쪽을 준다 —
   * 업데이트했다고 남의 장비를 버릴 수는 없다. 확장 횟수는 0이라 값은 처음부터 낸다.
   */
  6: (s) => {
    const owned = Array.isArray(s.inventory) ? s.inventory.length : 0;
    return { ...s, bag: { capacity: Math.max(BAG.capacity, owned), expansions: 0 } };
  },
};

/**
 * 옛 세이브를 최신 버전으로 끌어올린다.
 * 변환할 수 없으면 던진다 — 호출부(store.ts)가 원본을 백업하고 새 세이브로 시작한다.
 */
export function migrate(
  raw: unknown,
  chain: Record<number, Migration> = migrations,
  target: number = SAVE_VERSION,
): unknown {
  if (
    typeof raw !== 'object' ||
    raw === null ||
    typeof (raw as { version?: unknown }).version !== 'number'
  ) {
    throw new Error('세이브에 version이 없습니다');
  }
  let save = raw as Record<string, unknown> & { version: number };

  if (save.version > target) {
    throw new Error(`세이브(v${save.version})가 앱(v${target})보다 최신입니다`);
  }
  while (save.version < target) {
    const step = chain[save.version];
    if (!step) throw new Error(`v${save.version} → v${save.version + 1} 마이그레이션이 없습니다`);
    save = { ...step(save), version: save.version + 1 } as typeof save;
  }
  return save;
}
