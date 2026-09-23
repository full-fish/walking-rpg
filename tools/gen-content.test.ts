/**
 * `npm run gen` — 생성물을 src/content/data/에 쓴다.
 *
 * 테스트 파일인 건 Node가 확장자 없는 상대 import를 못 읽어서다(T7에서 겪은 것).
 * vitest로 돌리면 생성과 동시에 "쓴 게 스키마를 통과하는지"까지 공짜로 확인된다.
 * `npm test`는 --dir src라 이 파일을 건드리지 않는다 — 실수로 파일이 덮이지 않는다.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';

import { EquipmentsSchema, MonstersSchema } from '../src/content/schema';
import { FIELDS_PER_REGION, GEAR_SLOTS } from '../src/game/formulas';
import { generateAll, generateEquipment, generateUniques, REGIONS } from './gen-content';

const OUT = 'src/content/data/monsters';
const ITEMS = 'src/content/data/items';

test('gen — 지역별 몬스터 JSON을 쓴다', () => {
  mkdirSync(OUT, { recursive: true });

  for (const [region, monsters] of generateAll()) {
    expect(MonstersSchema.safeParse(monsters).success, `지역 ${region}`).toBe(true);

    const file = `${OUT}/region-${String(region).padStart(2, '0')}.json`;
    writeFileSync(file, JSON.stringify(monsters, null, 2) + '\n');

    const boss = monsters.find((m) => m.boss);
    console.log(
      `${file}  ${monsters.length}종 (티어 ${monsters[0].tier}~${monsters.at(-1)?.tier})` +
        `  보스 ${boss?.name} HP ${boss?.maxHp}`,
    );
  }

  expect(REGIONS).toHaveLength(5);
});

test('gen — 장비 정의 JSON을 쓴다 (§4.5)', () => {
  mkdirSync(ITEMS, { recursive: true });

  const equipment = generateEquipment();
  expect(EquipmentsSchema.safeParse(equipment).success).toBe(true);

  const file = `${ITEMS}/equipment.json`;
  writeFileSync(file, JSON.stringify(equipment, null, 2) + '\n');

  const set = equipment.filter((e) => e.tier === 10 && e.rarity === 'common');
  console.log(
    `${file}  ${equipment.length}종 (티어 1~10 × 부위 ${GEAR_SLOTS.length} × 등급 5)` +
      `  티어10 common 풀세트 ATK +${set.reduce((s, e) => s + e.atk, 0)}` +
      ` HP +${set.reduce((s, e) => s + e.maxHp, 0)}` +
      ` / ${set.reduce((s, e) => s + e.price, 0).toLocaleString()}골드`,
  );
});

test('gen — 사냥터 고유 장비 — 사냥터마다 한 종 (§4.4)', () => {
  mkdirSync(ITEMS, { recursive: true });

  const uniques = generateUniques();
  expect(EquipmentsSchema.safeParse(uniques).success).toBe(true);
  expect(uniques).toHaveLength(REGIONS.length * FIELDS_PER_REGION);

  const file = `${ITEMS}/unique.json`;
  writeFileSync(file, JSON.stringify(uniques, null, 2) + '\n');

  const first = uniques[0];
  console.log(`${file}  ${uniques.length}종  예) ${first.name} (Lv${first.level} ${first.slot}) ATK +${first.atk} HP +${first.maxHp}`);
});
