/**
 * 몬스터 sprite id → 이미지 (T17_7). itemIcons와 같은 이유로 require()를 한 줄씩 적는다 —
 * RN은 require 경로를 정적으로만 읽는다. 그림은 `node tools/crop-sprites.mjs boss`가 만든다.
 * 없는 sprite는 빠뜨려 두면 된다 — 전투 무대가 이름 상자로 대신 그린다.
 */
export const monsterIcons: Partial<Record<string, number>> = {
  boss_r1: require('@/assets/images/monsters/boss_r1.png'),
};
