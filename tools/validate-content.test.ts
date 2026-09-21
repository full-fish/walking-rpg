/**
 * `npm run validate` — 콘텐츠가 §7.4를 통과하는지 본다.
 *
 * 검증 자체는 validate-content.ts에 있다. T11의 gen-content.ts가 생성 직후에
 * 같은 함수를 부를 수 있어야 해서 실행 파일과 검사 로직을 나눠 뒀다.
 */
import { expect, test } from 'vitest';

import raw from '../src/content/archetypes/monsters.json';
import { MAX_TIER } from '../src/game/formulas';
import { validateContent } from './validate-content';

test('content — 원형 데이터가 §7.4 검증을 통과한다', () => {
  const monsters = raw.reduce((n, a) => n + a.tiers.length, 0);
  const power = raw.reduce((sum, a) => sum + a.power, 0) / raw.length;
  console.log(
    `원형 ${raw.length}개 / 몬스터 ${monsters}종 / power 평균 ${power.toFixed(3)}\n` +
      `티어별 종 수: ` +
      Array.from({ length: MAX_TIER }, (_, i) => raw.filter((a) => a.tiers.includes(i + 1)).length).join(
        ' ',
      ),
  );

  expect(validateContent()).toEqual([]);
});

test('content — 티어마다 최소 2종이 있어야 사냥터를 짤 수 있다 (§7.2⑤)', () => {
  for (let tier = 1; tier <= MAX_TIER; tier++) {
    const here = raw.filter((a) => a.tiers.includes(tier));
    expect.soft(here.length, `티어 ${tier}`).toBeGreaterThanOrEqual(2);
  }
});

/** 검사가 실제로 잡아내는지 — 통과만 하는 검증기는 없는 것과 같다. */
test('content — 깨진 데이터를 실제로 잡아낸다', () => {
  const ok = structuredClone(raw) as unknown[];
  const first = () => structuredClone(raw)[0];

  expect(validateContent(ok)).toEqual([]);

  // 이름 중복 — 다른 원형이 같은 이름을 쓰면 강함의 순서가 깨진다 (§7.2②)
  const dupName = structuredClone(raw);
  dupName[1].namePool[0] = dupName[0].namePool[0];
  expect(validateContent(dupName)).toEqual([`[이름 중복] ${raw[0].namePool[0]}`]);

  // ID 중복
  const dupId = structuredClone(raw);
  dupId[1].id = dupId[0].id;
  expect(validateContent(dupId)).toContain(`[ID 중복] ${raw[0].id}`);

  // tiers와 namePool 길이 불일치 (§7.4 #4)
  const lenMismatch = [first()];
  lenMismatch[0].tiers.push(9);
  expect(validateContent(lenMismatch)[0]).toContain('길이가 같아야');

  // 티어 범위 밖
  const badTier = [first()];
  badTier[0].tiers[0] = MAX_TIER + 1;
  expect(validateContent(badTier)[0]).toContain('[스키마]');

  // 형식이 아예 아닌 것
  expect(validateContent({}).length).toBeGreaterThan(0);
  expect(validateContent([]).length).toBeGreaterThan(0);
});
