/**
 * 무기 계열 문구 (T18). 캐릭터 탭 · 전투 화면 · balance.md가 같이 쓴다 — 화면마다 적으면 갈라진다.
 * 숫자는 전부 formulas에서 가져온다. React를 import하지 않는다 — 도구(balance)도 읽는다.
 */
import { ARROW_EFFECT, SKILL, STYLE_TRAIT, type ArrowEffect, type Style } from '@/game/formulas';

export const STYLE_LABEL: Record<Style, string> = {
  sword: '한손검',
  shield: '검과 방패',
  dual: '쌍칼',
  great: '대검',
  bow: '활',
};

export const SKILL_LABEL: Record<Style, string> = {
  sword: '집중 베기',
  shield: '가드',
  dual: '난무',
  great: '신체파괴',
  bow: '거리 벌리기',
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
const T = STYLE_TRAIT;

/** 계열 특성 한 줄 (사용자 결정 — 저절로 도는 규칙) */
export const STYLE_TRAIT_TEXT: Record<Style, string> = {
  sword: `명중 ${pct(T.sword.acc)} · 흔들림 ${pct(T.sword.roll[0])}~${pct(T.sword.roll[1])}`,
  shield: `${pct(T.shield.block)}로 막고 곧바로 반격 · 한 방 ×${T.shield.power}`,
  dual: `한 번에 두 번 벤다 · 연달아 맞히면 +${pct(T.dual.combo)}씩(최대 +${pct(T.dual.combo * T.dual.comboMax)}) · 한 방 ×${T.dual.power}`,
  great: `느림(행동 ×${T.great.tempo}) · 한 방 ×${T.great.power} · 치명 배율 +${T.great.crd} · 방어 ${pct(T.great.pierce)} 무시`,
  bow: `적이 다가오는 동안(${T.bow.approach}발) 나만 쏜다 · 화살 1발씩(없으면 ${pct(T.bow.noArrow)}) · 한 방 ×${T.bow.power}`,
};

/** 기술 한 줄 — 다섯 번 행동하면 저절로 쓴다 */
export const SKILL_TEXT: Record<Style, string> = {
  sword: '반드시 치명',
  shield: `다음 공격 ${SKILL.guard}번을 막고 반격`,
  dual: `곧바로 ${SKILL.flurry}번 벤다`,
  great: `그 전투 동안 적 공격 −${pct(SKILL.breakCut)}`,
  bow: `쏘고 물러난다 — 적이 다시 붙는 동안(${SKILL.retreat}발) 나만 쏜다`,
};

/** 기술이 도는 주기 */
export const SKILL_CYCLE = `${SKILL.gauge}번 행동하면 저절로`;

const E = ARROW_EFFECT;

/** 화살 효과 (T18 → T18_1) — 기본은 공격만. 특수는 몬스터가 떨군다 */
export const ARROW_EFFECT_TEXT: Record<ArrowEffect, string> = {
  basic: '공격만',
  pierce: `방어 무시 · 한 발 ×${E.pierce.power}`,
  fire: `치명 확률 +${pct(E.fire.cri!)}p`,
  bomb: `맞을 때마다 적 공격 −${pct(E.bomb.weaken!)} (최대 −${pct(E.bomb.weakenMax!)})`,
  thin: `빠르게 쏜다(행동 ×${E.thin.tempo}) · 한 발 ×${E.thin.power}`,
  ice: `맞을 때마다 적이 느려진다(×${E.ice.slow}, 최대 ×${E.ice.slowMin})`,
  vamp: `맞힐 때마다 최대 HP의 ${+(E.vamp.drain! * 100).toFixed(2)}% 회복`,
  shock: `${pct(E.shock.stun!)}로 적이 한 번 쉰다(보스는 절반)`,
  heavy: `느리게 쏜다(행동 ×${E.heavy.tempo}) · 한 발 ×${E.heavy.power} · 치명 배율 +${E.heavy.crd}`,
};
