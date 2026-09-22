/**
 * 장비 sprite id → 이미지. RN은 require()를 정적으로만 분석하기 때문에
 * (동적 경로 조합 불가) 새 이미지를 넣을 때마다 여기 한 줄씩 추가해야 한다.
 * 아직 없는 sprite는 그냥 빠뜨려두면 된다 — 쓰는 쪽에서 undefined를 아이콘 없음으로 처리한다.
 */
export const itemIcons: Partial<Record<string, number>> = {
  sword_1: require('@/assets/images/items/sword_1.png'),
};
