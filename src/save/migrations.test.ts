import { expect, test } from 'vitest';

import { migrate } from './migrations';
import { defaultSave, SAVE_VERSION, SaveSchema } from './schema';

const chain = {
  1: (s: Record<string, unknown>) => ({ ...s, gold: 10 }),
  2: (s: Record<string, unknown>) => ({ ...s, hp: 100 }),
};

test('기본 세이브는 스키마를 통과한다', () => {
  expect(() => SaveSchema.parse(defaultSave())).not.toThrow();
});

test('현재 버전이면 그대로 통과한다', () => {
  const save = defaultSave();
  expect(migrate(save)).toEqual(save);
});

test('체인을 순서대로 적용하고 version을 올린다', () => {
  expect(migrate({ version: 1 }, chain, 3)).toEqual({ version: 3, gold: 10, hp: 100 });
  expect(migrate({ version: 2 }, chain, 3)).toEqual({ version: 3, hp: 100 });
});

test('중간 단계가 없으면 던진다', () => {
  expect(() => migrate({ version: 1 }, { 2: (s) => s }, 3)).toThrow(/마이그레이션이 없습니다/);
});

test('앱보다 최신 세이브면 던진다(다운그레이드 금지)', () => {
  expect(() => migrate({ version: SAVE_VERSION + 1 })).toThrow(/최신입니다/);
});

test('version이 없으면 던진다', () => {
  expect(() => migrate({ player: {} })).toThrow(/version이 없습니다/);
  expect(() => migrate(null)).toThrow(/version이 없습니다/);
});

test('v1 stamina를 v2 wp로 옮기고 이미 지급한 걸음은 다시 주지 않는다', () => {
  const v1 = {
    version: 1,
    player: { level: 3, exp: 120, gold: 500, hp: 80 },
    stamina: { current: 4820, lastStepTotal: 7000, lastGrantDate: '2026-09-20' },
  };
  const latest = SaveSchema.parse(migrate(v1));
  expect(latest).toMatchObject({
    version: SAVE_VERSION,
    player: { level: 3, exp: 120, gold: 500, hp: 80 },
    wp: {
      current: 4820,
      grantedByDate: { '2026-09-20': 7000 },
      lastMidnightGrantAt: '2026-09-20',
    },
  });
});

test('v2 → v3: 지금까지 올린 레벨만큼 배분 포인트를 소급해서 준다', () => {
  const v2 = {
    version: 2,
    player: { level: 3, exp: 120, gold: 500, hp: 80 },
    wp: { current: 4820, grantedByDate: {}, lastMidnightGrantAt: '2026-09-20' },
  };
  const v3 = SaveSchema.parse(migrate(v2));

  expect(v3.statPoints).toEqual({ unspent: 2 * 3, str: 0, vit: 0, agi: 0, luk: 0, int: 0 });
  expect(v3.regionProgress).toEqual({ current: 1, unlocked: 1 });
  // 0으로 두면 첫 로드에서 24시간치 회복이 한 번에 들어온다 — 지금부터 센다
  expect(v3.hpUpdatedAt).toBeGreaterThan(0);
});

test('한 번도 안 켠 v1 세이브는 빈 지갑으로 간다(설치 기준선은 grantWp가 잡는다)', () => {
  const v1 = {
    version: 1,
    player: { level: 1, exp: 0, gold: 0, hp: 100 },
    stamina: { current: 0, lastStepTotal: 0, lastGrantDate: '' },
  };
  expect(SaveSchema.parse(migrate(v1)).wp).toEqual({
    current: 0,
    grantedByDate: {},
    lastMidnightGrantAt: '',
  });
});

test('v3 → v4: 인벤토리 칸이 생기고 INT는 0에서 시작한다 (§4.5, §4.3)', () => {
  const v3 = {
    version: 3,
    player: { level: 12, exp: 40, gold: 900, hp: 200 },
    wp: { current: 0, grantedByDate: {}, lastMidnightGrantAt: '' },
    hpUpdatedAt: 1,
    statPoints: { unspent: 5, str: 10, vit: 10, agi: 8, luk: 0 },
    regionProgress: { current: 2, unlocked: 2 },
  };
  const v4 = SaveSchema.parse(migrate(v3));

  // 배분해 둔 건 그대로 남는다 — 옛 세이브의 포인트를 회수하지 않는다
  expect(v4.statPoints).toEqual({ unspent: 5, str: 10, vit: 10, agi: 8, luk: 0, int: 0 });
  expect(v4.inventory).toEqual([]);
  // 여섯 칸이 전부 있어야 한다. 하나라도 없으면 장착 화면이 undefined를 만난다
  expect(Object.values(v4.equipped)).toEqual([null, null, null, null, null, null]);
});
