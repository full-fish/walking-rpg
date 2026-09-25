import { expect, test } from 'vitest';

import { defaultSave, type Save } from '../save/schema';
import { claimGoals, claimStreak, goalCells, goalsReady, regionPotion, streakNext } from './daily';
import { BAG } from './formulas';

const at = (day: number, hour = 10) => new Date(2026, 8, day, hour);
const mid = () => 0.5;

/** 그날까지 걸은 걸음 — WP가 센 값을 목표도 쓴다 */
function walked(steps: Record<string, number>, over: Partial<Save> = {}): Save {
  const base = defaultSave();
  return { ...base, wp: { ...base.wp, grantedByDate: steps }, ...over };
}

test('칸은 5,000보마다 하나, 여섯 칸에서 멈춘다', () => {
  expect([4_999, 5_000, 12_345, 30_000, 80_000].map(goalCells)).toEqual([0, 1, 2, 6, 6]);
});

test('걸음 목표 — 눌러야 들어오고, 두 번 눌러도 한 번이다', () => {
  const save = walked({ '2026-09-21': 12_000 });
  expect(goalsReady(save, at(21))).toEqual([{ date: '2026-09-21', from: 0, to: 2 }]);

  const r = claimGoals(save, at(21), mid)!;
  // 5,000 물약 1 · 10,000 하루 골드 10%
  expect(r.save.consumables[regionPotion(1)]).toBe(1);
  // 하루 골드 2,020 × 10% = 202 → 10G 단위로 200 (T19 검수)
  expect(r.save.player.gold).toBe(200);
  expect(r.save.daily['2026-09-21']).toBe(2);
  expect(claimGoals(r.save, at(21), mid)).toBeNull();

  // 더 걸으면 다음 칸부터 — 15,000 소재 1
  const more = { ...r.save, wp: { ...r.save.wp, grantedByDate: { '2026-09-21': 15_500 } } };
  const r2 = claimGoals(more, at(21), mid)!;
  expect(r2.got.materials).toHaveLength(1);
  expect(r2.save.daily['2026-09-21']).toBe(3);
});

test('안 켠 날도 3일 안이면 남아 있다 — 자정이 지나면 새 여섯 칸 (§3.6)', () => {
  const save = walked({ '2026-09-19': 6_000, '2026-09-20': 10_000, '2026-09-18': 20_000 });
  const ready = goalsReady(save, at(21)).map((d) => [d.date, d.to]);
  // 9/18은 4일 전이라 창 밖
  expect(ready).toEqual([
    ['2026-09-19', 1],
    ['2026-09-20', 2],
  ]);
  const r = claimGoals(save, at(21), mid)!;
  expect(r.save.consumables[regionPotion(1)]).toBe(2);
  expect(r.save.daily).toEqual({ '2026-09-19': 1, '2026-09-20': 2 });
});

test('30,000보 장비 — 가방이 차 있으면 기다렸다가, 비우면 받는다', () => {
  const full = walked(
    { '2026-09-21': 30_000 },
    { bag: { capacity: 0, expansions: 0 }, player: { ...defaultSave().player, gold: 0 } },
  );
  const r = claimGoals(full, at(21), mid)!;
  expect(r.waiting).toBe(true);
  expect(r.save.daily['2026-09-21']).toBe(5);
  expect(r.save.inventory).toHaveLength(0);
  // 가방 하나 비었다 — 이제 장비만 남아 있다
  const room = { ...r.save, bag: { capacity: BAG.capacity, expansions: 0 } };
  const r2 = claimGoals(room, at(21), mid)!;
  expect(r2.got.items).toHaveLength(1);
  expect(r2.waiting).toBe(false);
  expect(r2.save.daily['2026-09-21']).toBe(6);
});

test('출석 — 이어 받으면 +1, 하루 빠지면 1일째, 같은 날은 한 번', () => {
  let save = defaultSave();
  for (const day of [1, 2, 3, 4]) save = claimStreak(save, at(day), mid)!.save;
  expect(save.streak).toEqual({ count: 4, last: '2026-09-04' });
  expect(claimStreak(save, at(4, 23), mid)).toBeNull();

  // 5일에 안 켜고 6일에 켜면 — 봐주지 않는다, 1일째 칸부터
  expect(streakNext(save, at(6))).toEqual({ count: 1, cell: 0 });
  const r = claimStreak(save, at(6), mid)!;
  expect(r.count).toBe(1);
  // 2,020 × 5% = 101 → 100
  expect(r.save.player.gold).toBe(save.player.gold + 100);
});

test('출석 — 7일째 다음 날은 다시 첫 칸이다 (연속 일수는 계속 센다)', () => {
  let save = defaultSave();
  for (let day = 1; day <= 7; day++) save = claimStreak(save, at(day), mid)!.save;
  expect(streakNext(save, at(8))).toEqual({ count: 8, cell: 0 });
});

test('출석 — 시계를 되돌리면 그날은 안 준다', () => {
  const save = claimStreak(defaultSave(), at(10), mid)!.save;
  expect(claimStreak(save, at(9), mid)).toBeNull();
});
