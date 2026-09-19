/** 픽셀 테마 토큰. 색/폰트/간격은 전부 여기서만 바꾼다. */
export const colors = {
  bg: '#1A1626',
  panel: '#2A2438',
  edge: '#4A3F63',
  edgeLit: '#6B5C8C',
  text: '#F2E9DC',
  dim: '#8C7FA6',
  gold: '#E8B44A',
  hp: '#C8443C',
  stamina: '#54B47A',
  exp: '#4A8FD4',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const font = {
  family: 'Galmuri11',
  sm: 12,
  md: 14,
  lg: 18,
  xl: 24,
} as const;

/** 픽셀 테두리 두께. 라운드는 쓰지 않는다(도트 느낌 유지). */
export const border = 2;
