import type { ArrowEffect } from '@/game/formulas';

/**
 * 날아가는 화살 그림 (T18_1 연출 "나" — 코드로 그린 것과 둘 다 보고 고른다). 효과 → 이미지.
 * 그림은 assets/images/items/arrow/fly_<효과>.png(sprite-list.md 1-4). 정사각형 안에 세로로 선 화살이다.
 * 없는 효과는 코드로 그린 화살로 대신한다. RN은 require()를 정적으로만 읽어서 경로를 조합할 수 없다.
 */
export const arrowFlyIcons: Partial<Record<ArrowEffect, number>> = {
  basic: require('@/assets/images/items/arrow/fly_basic.png'),
  pierce: require('@/assets/images/items/arrow/fly_pierce.png'),
  fire: require('@/assets/images/items/arrow/fly_fire.png'),
  bomb: require('@/assets/images/items/arrow/fly_bomb.png'),
  thin: require('@/assets/images/items/arrow/fly_thin.png'),
  ice: require('@/assets/images/items/arrow/fly_ice.png'),
  vamp: require('@/assets/images/items/arrow/fly_vamp.png'),
  shock: require('@/assets/images/items/arrow/fly_shock.png'),
  heavy: require('@/assets/images/items/arrow/fly_heavy.png'),
};
