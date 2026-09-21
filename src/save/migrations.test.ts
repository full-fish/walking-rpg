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
  const v2 = SaveSchema.parse(migrate(v1));
  expect(v2).toEqual({
    version: 2,
    player: { level: 3, exp: 120, gold: 500, hp: 80 },
    wp: {
      current: 4820,
      grantedByDate: { '2026-09-20': 7000 },
      lastMidnightGrantAt: '2026-09-20',
    },
  });
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
