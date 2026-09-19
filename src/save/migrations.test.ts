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
