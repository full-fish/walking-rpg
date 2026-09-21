import type { Save } from '../save/schema';
import type { Outcome } from './battle';
import {
  combatStats,
  DEATH_GOLD_LOSS,
  DEATH_HP_RATIO,
  expToNext,
  HP_REGEN_INTERVAL_MS,
  HP_REGEN_MAX_ELAPSED_MS,
  HP_REGEN_RATE,
  INDIVIDUAL_REWARD_RATE,
  POINTS_PER_LEVEL,
  STARTING_STATS,
  type StatSpend,
} from './formulas';

/** 몬스터 1마리를 잡고 받는 것. */
export type Reward = { exp: number; gold: number };

/** 배분할 수 있는 1차 스탯 (§4.3). */
export type StatKey = keyof StatSpend;

/** 세이브의 레벨·배분으로 전투 스탯을 만든다. 화면과 전투가 반드시 이걸 거쳐 같은 값을 본다. */
export function statsOf(save: Save) {
  return combatStats(save.player.level, 'warrior', save.statPoints);
}

/**
 * 화면에 보이는 1차 스탯 = 직업 시작값 + 배분한 포인트 (§4.3).
 * 세이브에는 배분분만 있다 — 시작값은 직업의 성질이라 저장할 게 아니다.
 */
export function primaryStats(save: Save): StatSpend {
  const start = STARTING_STATS.warrior;
  return {
    str: start.str + save.statPoints.str,
    vit: start.vit + save.statPoints.vit,
    agi: start.agi + save.statPoints.agi,
    luk: start.luk + save.statPoints.luk,
  };
}

/**
 * 몬스터 1마리 처치 보상 = 그 몬스터의 기본값 × 0.54 (§4.4).
 * 나머지 몫은 한 판을 다 깼을 때 클리어 보너스로 나간다 — 그건 T16.
 *
 * 기본값은 gen-content가 §6.2·§6.3 공식으로 뽑아 몬스터에 박아둔 값이다.
 * 여기서 다시 계산하면 JSON과 어긋날 수 있다.
 */
export function killReward(base: Reward): Reward {
  return {
    exp: Math.round(base.exp * INDIVIDUAL_REWARD_RATE),
    gold: Math.round(base.gold * INDIVIDUAL_REWARD_RATE),
  };
}

/** EXP를 더하고 올라갈 수 있는 만큼 레벨을 올린다. 한 번에 여러 레벨도 오른다. */
export function addExp(level: number, exp: number, gained: number) {
  let nextLevel = level;
  let rest = exp + Math.max(0, Math.floor(gained));
  while (rest >= expToNext(nextLevel)) {
    rest -= expToNext(nextLevel);
    nextLevel += 1;
  }
  return { level: nextLevel, exp: rest, levelsGained: nextLevel - level };
}

/**
 * 마지막 갱신 이후 흐른 시간만큼 HP를 회복시킨다 — 10분당 최대 HP의 1% (§4.2).
 *
 * 시계를 뒤로 돌리면 회복 없이 기준 시각만 맞춘다(경과 음수 → 0).
 * 한 번 계산에 최대 24시간까지만 인정하므로, 한 달을 안 켰어도 하루치만 들어온다.
 * 쓰고 남은 자투리 시간은 updatedAt에 남겨 다음 계산으로 넘긴다.
 */
export function regenHp(hp: number, maxHp: number, updatedAt: number, now: number) {
  if (now < updatedAt) return { hp, updatedAt: now };
  if (hp >= maxHp) return { hp: maxHp, updatedAt: now };

  const elapsed = Math.min(now - updatedAt, HP_REGEN_MAX_ELAPSED_MS);
  const ticks = Math.floor(elapsed / HP_REGEN_INTERVAL_MS);
  if (ticks === 0) return { hp, updatedAt };

  return {
    hp: Math.min(maxHp, hp + Math.floor(maxHp * HP_REGEN_RATE * ticks)),
    updatedAt: updatedAt + ticks * HP_REGEN_INTERVAL_MS,
  };
}

/** 세이브에 HP 자연회복을 반영한다. 회복할 게 없으면 같은 객체를 그대로 돌려준다. */
export function applyRegen(save: Save, now: number): Save {
  const { hp, updatedAt } = regenHp(save.player.hp, statsOf(save).maxHp, save.hpUpdatedAt, now);
  if (hp === save.player.hp && updatedAt === save.hpUpdatedAt) return save;
  return { ...save, player: { ...save.player, hp }, hpUpdatedAt: updatedAt };
}

export type Settlement = {
  save: Save;
  outcome: Outcome;
  /** 실제로 받은 보상. 이기지 못했으면 0 */
  gained: Reward;
  levelsGained: number;
  /** 사망으로 잃은 소지 골드 */
  goldLost: number;
};

/**
 * 전투 하나를 정산해서 세이브에 반영한다 (§4.2 결과 3종).
 *
 *   win   보상 지급, HP는 싸우고 남은 만큼 유지
 *   flee  보상 없음, HP 유지 — 판의 클리어 보너스를 잃는 건 T16이 처리한다
 *   lose  보상 없음, 소지 골드 10% 상실(창고 면제), HP는 최대의 10%로 부활
 */
export function settleBattle(
  save: Save,
  outcome: Outcome,
  playerHp: number,
  reward: Reward,
  now: number,
): Settlement {
  const none: Reward = { exp: 0, gold: 0 };

  if (outcome === 'lose') {
    const goldLost = Math.floor(save.player.gold * DEATH_GOLD_LOSS);
    const revived = Math.max(1, Math.floor(statsOf(save).maxHp * DEATH_HP_RATIO));
    return {
      save: {
        ...save,
        player: { ...save.player, gold: save.player.gold - goldLost, hp: revived },
        hpUpdatedAt: now,
      },
      outcome,
      gained: none,
      levelsGained: 0,
      goldLost,
    };
  }

  const hp = Math.max(0, Math.floor(playerHp));

  if (outcome !== 'win') {
    return {
      save: { ...save, player: { ...save.player, hp }, hpUpdatedAt: now },
      outcome,
      gained: none,
      levelsGained: 0,
      goldLost: 0,
    };
  }

  const before = statsOf(save).maxHp;
  const leveled = addExp(save.player.level, save.player.exp, reward.exp);
  const next: Save = {
    ...save,
    player: {
      level: leveled.level,
      exp: leveled.exp,
      gold: save.player.gold + Math.max(0, Math.floor(reward.gold)),
      hp,
    },
    statPoints: {
      ...save.statPoints,
      unspent: save.statPoints.unspent + leveled.levelsGained * POINTS_PER_LEVEL,
    },
    hpUpdatedAt: now,
  };

  // 레벨업으로 늘어난 최대 HP만큼 현재 HP도 같이 올려준다 — 다친 정도는 그대로 둔다.
  const grown = statsOf(next).maxHp - before;
  if (grown > 0) next.player.hp = hp + grown;

  return {
    save: next,
    outcome,
    gained: { exp: reward.exp, gold: reward.gold },
    levelsGained: leveled.levelsGained,
    goldLost: 0,
  };
}

/** 남은 포인트 1점을 스탯에 넣는다. 포인트가 없으면 null — 호출부가 확인하게 강제한다. */
export function spendPoint(save: Save, stat: StatKey): Save | null {
  if (save.statPoints.unspent <= 0) return null;

  const before = statsOf(save).maxHp;
  const next: Save = {
    ...save,
    statPoints: {
      ...save.statPoints,
      unspent: save.statPoints.unspent - 1,
      [stat]: save.statPoints[stat] + 1,
    },
  };

  // VIT를 올려 최대 HP가 늘면 현재 HP도 같은 만큼 올린다.
  const grown = statsOf(next).maxHp - before;
  if (grown > 0) next.player = { ...next.player, hp: next.player.hp + grown };

  return next;
}
