import { BAG, GEAR_SLOTS, POINTS_PER_LEVEL, RING_SLOTS, VAULT } from '../game/formulas';
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

  /**
   * v7 → v8: 하의 칸 (§4.5, T17_4). 빈 칸으로 연다 — 없던 부위라 낄 게 없다.
   * 다른 부위의 HP·DEF 몫을 떼어 하의를 만들었으므로 **사서 끼기 전까지는 조금 약해진다.**
   */
  7: (s) => ({ ...s, equipped: { ...(s.equipped as object), pants: null } }),

  /**
   * v8 → v9: 보스 기록과 보스전 표시 (T17_5). 아직 아무도 보스를 안 만났다.
   * 진행 중인 판은 전부 사냥터 판이다 — 보스전은 이 버전부터 생긴다.
   */
  8: (s) => ({
    ...s,
    regionProgress: { ...(s.regionProgress as object), bosses: {} },
    run: s.run ? { ...(s.run as object), boss: false } : null,
  }),

  /** v9 → v10: 보스 버프 (T17_6 검수). 진행 중인 판에는 아직 버프가 없다 */
  9: (s) => ({ ...s, run: s.run ? { ...(s.run as object), buffs: [] } : null }),

  /**
   * v10 → v11: 반지 (T17_7). 고유 장비는 없앴다 — **가진 것도 지우고 낀 칸은 비운다**
   * (정의가 없어서 남겨 두면 읽는 순간 죽는다). 반지 칸 두 개를 빈 채로 연다.
   */
  10: (s) => {
    const inventory = (s.inventory as { uid: string; defId: string }[]).filter(
      (i) => !i.defId.startsWith('uniq_'),
    );
    const kept = new Set(inventory.map((i) => i.uid));
    const equipped = Object.fromEntries(
      Object.entries(s.equipped as Record<string, string | null>).map(([slot, uid]) => [
        slot,
        uid !== null && kept.has(uid) ? uid : null,
      ]),
    );
    return {
      ...s,
      inventory,
      equipped,
      rings: [],
      ringSlots: Array.from({ length: RING_SLOTS }, () => null),
    };
  },

  /** v11 → v12: 도감 · 걸음 목표 · 출석 (T19). 지금까지 잡은 몬스터는 기록이 없어 0부터 센다 */
  11: (s) => ({ ...s, dex: {}, daily: {}, streak: { count: 0, last: '' } }),
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
