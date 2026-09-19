import { SAVE_VERSION } from './schema';

/** vN 세이브를 v(N+1) 모양으로 바꾼다. version 필드는 migrate()가 알아서 올린다. */
type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/**
 * 버전별 변환 체인. 스키마를 바꿀 때 SAVE_VERSION을 올리고 여기에 한 줄 추가한다.
 * 예) 1: (s) => ({ ...s, player: { ...(s.player as object), job: 'warrior' } }),
 */
export const migrations: Record<number, Migration> = {};

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
