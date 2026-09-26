import {
  ACCURACY,
  actionRatio,
  approachTime,
  damageMultiplier,
  DAMAGE_ROLL_MAX,
  DAMAGE_ROLL_MIN,
  ARROW,
  HARDCAP_ACTIONS,
  SKILL,
  STYLE_TRAIT,
  type ArrowEffect,
  type ArrowEffectStats,
  type Style,
} from './formulas';

/** 활에 먹인 화살 한 종 (T18 → T18_1) — 쏠 때마다 더하는 공격과 효과 */
export type ArrowLoad = ArrowEffectStats & { effect: ArrowEffect; atk: number };

/** 전투에 참여하는 한쪽. 플레이어든 몬스터든 같은 모양이다. */
export type Combatant = {
  name: string;
  /** 전투 시작 시점의 HP. 사냥터 안에서는 이전 전투에서 이어진다 (§4.2) */
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  /** 크리 확률 0~1 */
  cri: number;
  /** 크리 배율 */
  crd: number;
  /** 회피 확률 0~1 */
  eva: number;
  /**
   * 여태 받은 성장 배수 (§4.2). Lv1 플레이어와 티어 0 몬스터가 1.0.
   * 피해배율의 K를 같이 키워서 DEF의 감소율이 레벨을 타지 않게 한다.
   */
  scale?: number;
  /** 보스인가 (T17_5). 반지의 보스 피해가 이걸 본다 */
  boss?: boolean;
  /** 보스에게 더 주는 피해 비율 (T17_7 반지) */
  bossDamage?: number;
  /** 전투를 시작할 때 HP보다 먼저 깎이는 보호막 (T17_7 반지). 이 전투가 끝나면 사라진다 */
  shield?: number;
  /** 명중 0~1 (T18). 없으면 ACCURACY — 몬스터는 늘 이 값이다 */
  acc?: number;
  /** 무기 계열 (T18) — 플레이어만. 없으면 특성 · 기술 없이 친다 */
  style?: Style;
  /** 행동 빠르기 배수 — 대검 0.7 (T18) */
  tempo?: number;
  /** 한 방 배수 — 대검 1.4 (T18). 느린 만큼 크다 */
  power?: number;
  /** 한 번 행동에 몇 번 베나 — 단검 두 자루면 2 (T18 연격) */
  hits?: number;
  /** 막을 확률 — 방패를 든 검과 방패 (T18) */
  block?: number;
  /** 방어 무시 비율 0~1 — 대검 (T18) */
  pierce?: number;
  /** 활에 먹인 화살 (T18) — 쏠 때마다 더하는 공격과 효과 */
  arrow?: ArrowLoad;
  /** 가진 화살 수 (T18). 떨어지면 활로 친다(STYLE_TRAIT.bow.noArrow) */
  arrows?: number;
};

/**
 * 전투가 들고 가는 상태 (T18). 이벤트마다 **그 뒤의 상태**를 붙여 둔다 —
 * 물약으로 끊고 남은 싸움을 다시 뽑을 때 여기서 이어 받는다(게이지 · 콤보 · 화살 · 보호막이 안 새로 찬다).
 */
export type BattleState = {
  /** 기술 게이지 — SKILL.gauge에 닿으면 다음 행동이 기술이다 */
  gauge: number;
  /** 쌍칼 콤보 — 연달아 맞힌 수 */
  combo: number;
  /** 신체파괴가 겹친 수 — 적 공격이 그만큼 줄어 있다 */
  broken: number;
  /** 가드가 남은 막기 수 */
  guard: number;
  /** 남은 화살 */
  arrows: number;
  /** 남은 보호막 (T17_7 반지) — 맞을 때마다 먼저 깎이고 차지 않는다 */
  shield: number;
  /** 활의 첫 거리를 이미 썼나 — 물약으로 이어 뽑을 때 또 주지 않는다 */
  opened: boolean;
  /** 폭탄 화살이 깎은 적 공격 비율 (T18_1) — 신체파괴와 따로 곱한다 */
  weak: number;
  /** 얼음 화살이 늦춘 적 행동 배수 (T18_1) — 1이면 그대로 */
  chill: number;
  /** 번개 화살에 맞아 적이 다음 차례를 쉰다 (T18_1) */
  stun: boolean;
  /** 흡혈 화살이 모아 둔 1 미만의 HP (T18_1) — HP는 정수라 모였다가 1씩 찬다 */
  leech: number;
};

export type BattleEvent = {
  /** 0부터. 화면은 이 순서대로 0.6초에 한 칸씩 재생한다 (T8) */
  seq: number;
  actor: 'player' | 'monster';
  /** block은 막아서 0, guard는 가드를 세운 행동 (T18). stun은 번개에 맞아 쉰 적의 차례 (T18_1) */
  type: 'hit' | 'crit' | 'miss' | 'block' | 'guard' | 'stun';
  /** 준 대미지. miss · block · guard · stun이면 0 */
  value: number;
  /** 맞은 쪽의 남은 HP */
  hpAfter: number;
  /** 앞 이벤트와 같은 칸이다 — 연격 두 번째 · 난무 · 막은 뒤 반격 (T18). 화면이 한 번에 그린다 */
  chain?: true;
  /** 기술로 나온 행동의 첫 이벤트 (T18) — 기술 이름은 계열이 정한다 */
  skill?: true;
  /** 막은 뒤 반격 (T18) */
  counter?: true;
  /** 쏜 화살의 효과 (T18 → T18_1). 없으면 화살 없이 쳤다 — 화면이 화살마다 다르게 그린다 */
  arrow?: ArrowEffect;
  /** 흡혈 화살로 찬 HP와 그 뒤 내 HP (T18_1) — 내 공격인데 내 HP가 바뀌는 유일한 경우다 */
  heal?: number;
  selfHp?: number;
  /** 적이 아직 다가오는 중 — 남은 거리 0~1 (T18 활). 화면이 적을 작게 그린다 */
  far?: number;
  state: BattleState;
};

/**
 * 무승부는 없다 (§3.5).
 * flee는 하드캡에 걸렸을 때만 — 유저가 누르는 [도망]은 T8이 재생을 끊는 것이다.
 */
export type Outcome = 'win' | 'lose' | 'flee';

export type BattleResult = {
  events: BattleEvent[];
  outcome: Outcome;
  /** 전투 후 HP. 다음 몬스터로 그대로 이어진다 (§4.2) */
  playerHp: number;
  monsterHp: number;
  /** 끝난 뒤의 상태 — 쓴 화살은 처음 화살에서 이걸 뺀다 */
  state: BattleState;
};

/**
 * 재현 가능한 난수 (mulberry32). 같은 시드면 같은 전투가 나온다.
 * 테스트와 시뮬레이터(T12)가 전투를 다시 돌려보려고 쓴다.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 한 번 휘두르는 것 — 누가 치든 같은 모양이다 */
type Swing = {
  atk: number;
  acc: number;
  cri: number;
  crd: number;
  pierce: number;
  roll: readonly [number, number];
  /** 빗나가지 않는다 — 기술 (T18) */
  sure?: boolean;
  /** 반드시 치명 — 집중 베기 (T18) */
  crit?: boolean;
};

const ROLL = [DAMAGE_ROLL_MIN, DAMAGE_ROLL_MAX] as const;

/** 맞았나 — 명중을 먼저, 그다음 상대의 회피를 따로 굴린다 (T18) */
function lands(sw: Swing, target: Combatant, rng: () => number): boolean {
  if (sw.sure) return true;
  if (rng() >= sw.acc) return false;
  return rng() >= target.eva;
}

/** 맞은 공격의 대미지. 기본 대미지 → 크리 → 최소 1 보장 (§4.2) */
function damage(sw: Swing, target: Combatant, rng: () => number, bossDamage: number) {
  const roll = sw.roll[0] + rng() * (sw.roll[1] - sw.roll[0]);
  let value = sw.atk * damageMultiplier(target.def * (1 - sw.pierce), target.scale) * roll;
  if (target.boss) value *= 1 + bossDamage;

  const critical = sw.crit === true || rng() < sw.cri;
  if (critical) value *= sw.crd;

  return {
    type: critical ? ('crit' as const) : ('hit' as const),
    value: Math.max(1, Math.floor(value)),
  };
}

/**
 * 마지막으로 actor가 때렸을 때 맞은 쪽의 HP. 아직 안 맞았으면 초기값.
 *
 * 미리 계산한 전투를 **중간에서 끊을 때** 그 순간의 HP를 구한다 — 물약을 마시고 남은
 * 싸움을 다시 뽑는 전투 화면과 시뮬레이터가 둘 다 이걸로 끊는다 (T17_3).
 */
export function hpAfterLastHitBy(
  events: BattleEvent[],
  actor: BattleEvent['actor'],
  initial: number,
): number {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].actor === actor) return events[i].hpAfter;
  }
  return initial;
}

/**
 * 그 순간 내 HP (T18_1) — 적이 친 뒤(hpAfter)나 흡혈로 찬 뒤(selfHp) 중 마지막 것. 아직 둘 다 없으면 초기값.
 * 흡혈 전에는 hpAfterLastHitBy(events, 'monster')와 같았다.
 */
export function playerHpAfter(events: BattleEvent[], initial: number): number {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.actor === 'monster') return e.hpAfter;
    if (e.selfHp !== undefined) return e.selfHp;
  }
  return initial;
}

/** 새 전투의 상태 — 게이지 0, 반지 보호막과 화살은 가진 만큼 (T18) */
export function startState(player: Combatant): BattleState {
  return {
    gauge: 0,
    combo: 0,
    broken: 0,
    guard: 0,
    arrows: player.arrows ?? 0,
    shield: player.shield ?? 0,
    opened: false,
    weak: 0,
    chill: 1,
    stun: false,
    leech: 0,
  };
}

/**
 * 전투 한 판을 끝까지 계산해서 이벤트 배열로 돌려준다.
 * 화면(T8)은 아무것도 계산하지 않고 이 배열을 재생만 한다.
 *
 * ATB: 몬스터를 기준 시계(1)로 삼고 플레이어는 SPD 비율만큼 빠르게/느리게 행동한다.
 * ratio > 1이면 tPlayer가 tMonster보다 작게 시작해 자연히 선공이 된다 (§4.2).
 *
 * 무기 계열(T18)의 특성과 기술도 여기서 돈다 — 화면 · 시뮬이 따로 계산하지 않는다.
 * `resume`을 주면 그 상태에서 이어 싸운다(물약으로 끊었을 때). 행동 순서는 처음부터 다시 센다.
 */
export function simulateBattle(
  player: Combatant,
  monster: Combatant,
  rng: () => number,
  resume?: BattleState,
): BattleResult {
  const events: BattleEvent[] = [];
  const s: BattleState = { ...(resume ?? startState(player)) };
  let playerHp = player.hp;
  let monsterHp = monster.hp;
  const style = player.style;

  const ratio = actionRatio(player.spd, monster.spd) * (player.tempo ?? 1);
  /** 먹인 화살이 남아 있나 (T18) — 가는 · 무거운 화살은 남아 있는 동안만 빠르기를 바꾼다(T18_1) */
  const loaded = () => style === 'bow' && s.arrows > 0 && player.arrow !== undefined;
  const step = () => 1 / (ratio * (loaded() ? player.arrow!.tempo : 1));
  let tPlayer = step();
  let tMonster = 1;
  // 활의 거리 (T18) — 적이 다가오는 동안 나만 쏜다. 이어 뽑을 때는 또 주지 않는다
  const reach = style === 'bow' ? approachTime(STYLE_TRAIT.bow.approach) : 0;
  let arrive = 0;
  if (reach > 0 && !s.opened) {
    tMonster += reach;
    arrive = tMonster;
  }
  s.opened = true;

  const push = (e: Omit<BattleEvent, 'seq' | 'state'>) => {
    events.push({ ...e, seq: events.length, state: { ...s } });
  };
  /** 적이 아직 다가오는 중이면 남은 거리 (T18 활) */
  const far = (t: number) => (arrive > t ? { far: Math.min(1, (arrive - t) / reach) } : {});

  type HitOpts = {
    part?: number;
    sure?: boolean;
    crit?: boolean;
    at?: { far?: number };
    tag?: Pick<BattleEvent, 'chain' | 'skill' | 'counter'>;
    /** 맞았을 때 이벤트를 남기기 전에 — 신체파괴가 쓴다 */
    onLand?: () => void;
  };

  /** 내 공격 한 번. 계열이 화살 · 콤보 · 흔들림을 정한다 */
  const hit = ({ part = 1, sure, crit, at, tag, onLand }: HitOpts) => {
    let atk = player.atk * part * (player.power ?? 1);
    let cri = player.cri;
    let crd = player.crd;
    let pierce = player.pierce ?? 0;
    let arrow: ArrowLoad | undefined;
    if (style === 'bow') {
      if (loaded()) {
        s.arrows -= 1;
        arrow = player.arrow!;
        atk = (atk + arrow.atk) * arrow.power;
        cri += arrow.cri;
        crd += arrow.crd;
        pierce = Math.max(pierce, arrow.pierce);
      } else {
        atk *= STYLE_TRAIT.bow.noArrow;
      }
    }
    const dual = STYLE_TRAIT.dual;
    if (style === 'dual') atk *= 1 + Math.min(s.combo, dual.comboMax) * dual.combo;

    const sw: Swing = {
      atk,
      acc: player.acc ?? ACCURACY,
      cri,
      crd,
      pierce,
      roll: style === 'sword' ? STYLE_TRAIT.sword.roll : ROLL,
      sure,
      crit,
    };
    const r = lands(sw, monster, rng)
      ? damage(sw, monster, rng, player.bossDamage ?? 0)
      : { type: 'miss' as const, value: 0 };
    if (style === 'dual') s.combo = r.type === 'miss' ? 0 : s.combo + 1;
    if (r.type !== 'miss') onLand?.();
    const drained = r.type !== 'miss' && arrow ? landArrow(arrow) : {};
    monsterHp = Math.max(0, monsterHp - r.value);
    push({
      actor: 'player',
      type: r.type,
      value: r.value,
      hpAfter: monsterHp,
      ...tag,
      ...(arrow ? { arrow: arrow.effect } : {}),
      ...drained,
      ...at,
    });
  };

  /**
   * 특수 화살이 맞았을 때 (T18_1) — 폭탄은 적 공격을, 얼음은 적 빠르기를 그 전투 끝까지 깎고,
   * 번개는 적의 다음 차례를 쉬게 하고, 흡혈은 내 최대 HP의 몫을 되찾는다(모였다가 1씩 — 그 몫을 이벤트에 싣는다)
   */
  const landArrow = (a: ArrowLoad) => {
    if (a.weaken > 0) s.weak = Math.min(a.weakenMax, s.weak + a.weaken);
    if (a.slow < 1) s.chill = Math.max(a.slowMin, s.chill * a.slow);
    if (a.stun > 0 && rng() < a.stun * (monster.boss ? ARROW.bossStun : 1)) s.stun = true;
    if (a.drain <= 0) return {};
    s.leech += player.maxHp * a.drain;
    const heal = Math.min(player.maxHp - playerHp, Math.floor(s.leech));
    s.leech -= Math.floor(s.leech);
    playerHp += heal;
    return { heal, selfHp: playerHp };
  };

  /** 내 차례 — 게이지가 차 있으면 기술, 아니면 평소대로 (T18) */
  const playerTurn = (t: number) => {
    const skill = style !== undefined && s.gauge >= SKILL.gauge;
    s.gauge = skill ? 0 : style !== undefined ? s.gauge + 1 : 0;
    const at = far(t);
    const n = player.hits ?? 1;

    if (!skill) {
      for (let i = 0; i < n && monsterHp > 0; i++) {
        hit({ part: 1 / n, at, tag: i > 0 ? { chain: true } : undefined });
      }
      return;
    }
    switch (style) {
      case 'sword':
        hit({ sure: true, crit: true, at, tag: { skill: true } });
        return;
      case 'shield':
        s.guard = SKILL.guard;
        push({ actor: 'player', type: 'guard', value: 0, hpAfter: monsterHp, skill: true, ...at });
        return;
      case 'dual':
        for (let i = 0; i < SKILL.flurry && monsterHp > 0; i++) {
          hit({ part: 1 / n, sure: true, at, tag: i > 0 ? { chain: true } : { skill: true } });
        }
        return;
      case 'great':
        hit({
          sure: true,
          at,
          tag: { skill: true },
          onLand: () => {
            s.broken = Math.min(SKILL.breakMax, s.broken + 1);
          },
        });
        return;
      case 'bow':
        hit({ sure: true, at, tag: { skill: true } });
        // 쏘고 물러난다 — 적이 다시 다가오는 동안 나만 쏜다
        tMonster += approachTime(SKILL.retreat);
        arrive = tMonster;
        return;
    }
  };

  /** 몬스터 차례 — 기절(번개) → 명중 → 회피 → 막기(가드 · 방패) → 대미지 */
  const monsterTurn = () => {
    if (s.stun) {
      s.stun = false;
      push({ actor: 'monster', type: 'stun', value: 0, hpAfter: playerHp });
      return;
    }
    const sw: Swing = {
      atk: monster.atk * (1 - SKILL.breakCut * s.broken) * (1 - s.weak),
      acc: monster.acc ?? ACCURACY,
      cri: monster.cri,
      crd: monster.crd,
      pierce: 0,
      roll: ROLL,
    };
    if (!lands(sw, player, rng)) {
      push({ actor: 'monster', type: 'miss', value: 0, hpAfter: playerHp });
      return;
    }
    const guarded = s.guard > 0;
    if (guarded || ((player.block ?? 0) > 0 && rng() < player.block!)) {
      if (guarded) s.guard -= 1;
      push({ actor: 'monster', type: 'block', value: 0, hpAfter: playerHp });
      // 막으면 곧바로 반격 (T18 검과 방패)
      hit({ tag: { chain: true, counter: true } });
      return;
    }
    const r = damage(sw, player, rng, 0);
    // 보호막이 먼저 받는다. 이벤트의 value는 준 피해 그대로다 — 화면은 막힌 몫을 따로 보여준다
    const absorbed = Math.min(s.shield, r.value);
    s.shield -= absorbed;
    playerHp = Math.max(0, playerHp - (r.value - absorbed));
    push({ actor: 'monster', type: r.type, value: r.value, hpAfter: playerHp });
  };

  while (playerHp > 0 && monsterHp > 0) {
    if (events.length >= HARDCAP_ACTIONS) {
      console.warn(
        `[battle] 행동 ${HARDCAP_ACTIONS}회 하드캡 — ${player.name} vs ${monster.name}. 밸런스를 확인할 것.`,
      );
      return { events, outcome: 'flee', playerHp, monsterHp, state: s };
    }

    if (tPlayer <= tMonster) {
      playerTurn(tPlayer);
      tPlayer += step();
    } else {
      monsterTurn();
      // 얼음 화살(T18_1)에 늦춰진 만큼 다음 차례가 멀다
      tMonster += 1 / s.chill;
    }
  }

  return { events, outcome: monsterHp <= 0 ? 'win' : 'lose', playerHp, monsterHp, state: s };
}
