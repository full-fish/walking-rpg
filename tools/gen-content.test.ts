/**
 * `npm run gen` — 생성물을 src/content/data/에 쓴다.
 *
 * 테스트 파일인 건 Node가 확장자 없는 상대 import를 못 읽어서다(T7에서 겪은 것).
 * vitest로 돌리면 생성과 동시에 "쓴 게 스키마를 통과하는지"까지 공짜로 확인된다.
 * `npm test`는 --dir src라 이 파일을 건드리지 않는다 — 실수로 파일이 덮이지 않는다.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';

import { MonstersSchema } from '../src/content/schema';
import { generateAll, REGIONS } from './gen-content';

const OUT = 'src/content/data/monsters';

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

  expect(REGIONS).toHaveLength(2);
});
