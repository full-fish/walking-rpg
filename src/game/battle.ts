import {
  actionRatio,
  damageMultiplier,
  DAMAGE_ROLL_MAX,
  DAMAGE_ROLL_MIN,
  HARDCAP_ACTIONS,
} from './formulas';

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
};

export type BattleEvent = {
  /** 0부터. 화면은 이 순서대로 0.6초에 하나씩 재생한다 (T8) */
  seq: number;
  actor: 'player' | 'monster';
  type: 'hit' | 'crit' | 'miss';
  /** 준 대미지. miss면 0 */
  value: number;
  /** 맞은 쪽의 남은 HP */
  hpAfter: number;
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

/** 공격 한 번. 판정 순서는 회피 → 기본 대미지 → 크리 → 최소 1 보장 (§4.2). */
function strike(attacker: Combatant, target: Combatant, rng: () => number) {
  if (rng() < target.eva) return { type: 'miss' as const, value: 0 };

  const roll = DAMAGE_ROLL_MIN + rng() * (DAMAGE_ROLL_MAX - DAMAGE_ROLL_MIN);
  let damage = attacker.atk * damageMultiplier(target.def, target.scale) * roll;
  if (target.boss) damage *= 1 + (attacker.bossDamage ?? 0);

  const critical = rng() < attacker.cri;
  if (critical) damage *= attacker.crd;

  return {
    type: critical ? ('crit' as const) : ('hit' as const),
    value: Math.max(1, Math.floor(damage)),
  };
}

/**
 * 전투 한 판을 끝까지 계산해서 이벤트 배열로 돌려준다.
 * 화면(T8)은 아무것도 계산하지 않고 이 배열을 재생만 한다.
 *
 * ATB: 몬스터를 기준 시계(1)로 삼고 플레이어는 SPD 비율만큼 빠르게/느리게 행동한다.
 * ratio > 1이면 tPlayer가 tMonster보다 작게 시작해 자연히 선공이 된다 (§4.2).
 */
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
 * 그 이벤트들이 지나간 뒤 남은 보호막 (T17_7 반지). 보호막은 맞을 때마다 먼저 깎이고 차지 않으므로
 * 몬스터가 준 피해의 합만큼 줄어 있다. 물약으로 끊고 다시 뽑을 때 이어 붙이는 값이다.
 */
export function shieldLeft(events: BattleEvent[], shield: number): number {
  const taken = events.reduce((sum, e) => sum + (e.actor === 'monster' ? e.value : 0), 0);
  return Math.max(0, shield - taken);
}

export function simulateBattle(
  player: Combatant,
  monster: Combatant,
  rng: () => number,
): BattleResult {
  const events: BattleEvent[] = [];
  let playerHp = player.hp;
  let monsterHp = monster.hp;
  let shield = player.shield ?? 0;

  const step = 1 / actionRatio(player.spd, monster.spd);
  let tPlayer = step;
  let tMonster = 1;

  while (playerHp > 0 && monsterHp > 0) {
    if (events.length >= HARDCAP_ACTIONS) {
      console.warn(
        `[battle] 행동 ${HARDCAP_ACTIONS}회 하드캡 — ${player.name} vs ${monster.name}. 밸런스를 확인할 것.`,
      );
      return { events, outcome: 'flee', playerHp, monsterHp };
    }

    const playerActs = tPlayer <= tMonster;
    const { type, value } = playerActs
      ? strike(player, monster, rng)
      : strike(monster, player, rng);

    if (playerActs) {
      monsterHp = Math.max(0, monsterHp - value);
      tPlayer += step;
    } else {
      // 보호막이 먼저 받는다. 이벤트의 value는 준 피해 그대로다 — 화면은 막힌 몫을 따로 보여준다
      const blocked = Math.min(shield, value);
      shield -= blocked;
      playerHp = Math.max(0, playerHp - (value - blocked));
      tMonster += 1;
    }

    events.push({
      seq: events.length,
      actor: playerActs ? 'player' : 'monster',
      type,
      value,
      hpAfter: playerActs ? monsterHp : playerHp,
    });
  }

  return { events, outcome: monsterHp <= 0 ? 'win' : 'lose', playerHp, monsterHp };
}
