import { arrowById, gearSetFor } from '../content';
import { defaultSave, type Save } from '../save/schema';
import type { Outcome } from './battle';
import { bossBonus, dexStats } from './dex';
import {
  ACCURACY,
  MATERIAL_BUFF,
  combatStats,
  GEAR_SLOTS,
  DEATH_GOLD_LOSS,
  DEATH_HP_RATIO,
  expToNext,
  HP_REGEN_INTERVAL_MS,
  HP_REGEN_MAX_ELAPSED_MS,
  HP_REGEN_RATE,
  INDIVIDUAL_REWARD_RATE,
  NAME,
  POINTS_PER_LEVEL,
  RING_SLOTS,
  SPENDABLE_STATS,
  STARTING_STATS,
  STYLE_TRAIT,
  handPartner,
  WP_COST,
  type GearSlot,
  type HandLine,
  type SpendableStat,
  type StatSpend,
  type Style,
} from './formulas';
import {
  bagFull,
  bagItems,
  equippedIn,
  equippedStats,
  fitsSlot,
  HANDS,
  heldHands,
  isHand,
  isHandLine,
  itemByUid,
  itemDef,
  itemPower,
  otherHand,
  ringBonus,
  styleOf,
  type Hand,
} from './items';
import { spendWp } from './wp';

/** 몬스터 1마리를 잡고 받는 것. */
export type Reward = { exp: number; gold: number };

/** 배분할 수 있는 1차 스탯 (§4.3). */
export type StatKey = SpendableStat;

/**
 * 세이브의 레벨·배분·**장비**로 전투 스탯을 만든다 (§4.3, §4.5).
 * 화면과 전투가 반드시 이걸 거쳐 같은 값을 본다.
 *
 * 맨몸은 찍은 포인트에 선형으로 자라고, 몬스터와의 격차는 장비가 메운다 —
 * Lv50 기준 전투력의 60%가 장비 몫이다 (T17_7 검수 4차). 맨몸으로 후반 사냥터에 가면 그래서 안 된다.
 */
export function statsOf(save: Save) {
  // 도감 (T19) — 100마리 카드 · 지역 완성 스탯은 배분 포인트처럼 1차 스탯에 더한다
  const dex = dexStats(save);
  const points = save.statPoints;
  const spend = {
    ...points,
    str: points.str + dex.str,
    vit: points.vit + dex.vit,
    agi: points.agi + dex.agi,
    luk: points.luk + dex.luk,
  };
  const base = combatStats(save.player.level, spend, equippedStats(save));
  // 반지 (T17_7) — 전투력 축 밖의 것만 준다. 입장 WP·자정 WP·6마리 판·클리어 보너스·물약은 쓰는 곳이 본다
  // 보스 도감 3번(T19 검수 2차)도 EXP · 골드에 같이 더한다
  const boss = bossBonus(save).expGold;
  const stats = {
    ...base,
    ...styleStats(save, styleOf(save), base.crd),
    goldMult: base.goldMult + ringBonus(save, 'gold') + boss,
    dropMult: base.dropMult + ringBonus(save, 'drop'),
    /** EXP 배율 — 반지와 보스 도감만 올린다. 행운은 EXP에 안 붙는다 (§4.3) */
    expMult: 1 + ringBonus(save, 'exp') + boss,
    /** 전투마다 HP보다 먼저 깎이는 보호막 */
    shield: Math.round(base.maxHp * ringBonus(save, 'shield')),
    /** 보스에게 더 주는 피해 비율 */
    bossDamage: ringBonus(save, 'bossDamage'),
  };
  // 소재 버프 (T17_6 검수, 사냥터는 T17_7 검수 5차) — 그 판에만 붙는다. 전투 화면·시뮬·HP 막대가 전부 여기를 지나서 한 곳이면 된다
  const mult = buffMult(save);
  for (const stat of save.run?.buffs ?? []) stats[stat] *= mult;
  return stats;
}

/**
 * 무기 계열의 특성을 전투 스탯으로 (T18). **1점 값은 안 건드린다** — 무기가 정한 규칙만 얹는다.
 * 연격은 단검 두 자루, 막기는 방패를 들어야 한다. 활은 먹인 화살을 들고 간다.
 */
function styleStats(save: Save, style: Style, crd: number) {
  const trait = STYLE_TRAIT;
  // 두 손 칸은 똑같다 (T18 확인) — 어느 손에 들었든 센다
  const lines = heldHands(save).map((i) => itemDef(i).line);
  const quiver = style === 'bow' && save.quiver ? arrowById(save.quiver) : undefined;
  return {
    style,
    acc: style === 'sword' ? trait.sword.acc : ACCURACY,
    crd: crd + (style === 'great' ? trait.great.crd : 0),
    tempo: style === 'great' ? trait.great.tempo : 1,
    power: trait[style].power,
    hits: lines.filter((l) => l === 'dagger').length === 2 ? trait.dual.hits : 1,
    block: lines.includes('shield') ? trait.shield.block : 0,
    pierce: style === 'great' ? trait.great.pierce : 0,
    arrow: quiver,
    arrows: quiver ? (save.arrows[quiver.id] ?? 0) : 0,
  };
}

/** 소재 버프 하나의 배율 — ×1.1에 결의의 반지(T17_7)가 더한다 */
export function buffMult(save: Save): number {
  return MATERIAL_BUFF.mult + ringBonus(save, 'bossBuff');
}

/**
 * 화면에 보이는 1차 스탯 = 시작값 + 배분한 포인트 (§4.3).
 * 세이브에는 배분분만 있다 — 시작값은 모두 같아서 저장할 게 아니다.
 */
export function primaryStats(save: Save): StatSpend {
  const start = STARTING_STATS;
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
export function killReward(base: Reward, goldMult = 1, expMult = 1): Reward {
  return {
    // EXP 반지(T17_7)만 EXP를 늘린다
    exp: Math.round(base.exp * INDIVIDUAL_REWARD_RATE * expMult),
    // 행운은 골드에만 붙는다 (§4.3). EXP까지 늘리면 LUK이 성장 속도까지 사는 스탯이 된다
    gold: Math.round(base.gold * INDIVIDUAL_REWARD_RATE * goldMult),
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
      ...save.player,
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

/** 재분배가 공짜인 레벨 (§4.3). 이 아래는 아직 실수할 여유를 준다. */
export const RESPEC_FREE_BELOW = 10;

/** 재분배에 드는 WP. Lv10 미만은 0 (§4.3). */
export function respecCost(level: number): number {
  return level < RESPEC_FREE_BELOW ? 0 : WP_COST.statRespec;
}

/**
 * 배분한 포인트를 전부 되돌린다 (§4.3, T17). WP가 모자라면 null.
 *
 * **현재 HP는 새 최대치로 자르기만 하고 비율을 유지하지 않는다.** VIT를 빼면 최대 HP가
 * 줄고 현재 HP도 같이 잘리는데, 여기서 비율을 되돌려주면 "VIT를 뺐다 다시 넣어"
 * 만피를 만드는 우회가 생긴다 — 회복은 물약과 여관이 파는 것이다 (§4.5).
 */
export function respec(save: Save): Save | null {
  const wp = spendWp(save.wp, respecCost(save.player.level));
  if (!wp) return null;

  const spent = SPENDABLE_STATS.reduce((sum, k) => sum + save.statPoints[k], 0);
  const next: Save = {
    ...save,
    wp,
    statPoints: {
      ...save.statPoints,
      unspent: save.statPoints.unspent + spent,
      str: 0,
      vit: 0,
      agi: 0,
      luk: 0,
    },
  };

  return { ...next, player: { ...next.player, hp: Math.min(next.player.hp, statsOf(next).maxHp) } };
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

/**
 * 장비를 낀다 (§4.5). 같은 칸에 있던 건 인벤토리로 돌아간다 — 버리지 않는다.
 * 없는 uid거나 요구 레벨이 모자라거나 그 칸에 못 끼면 null을 준다. 호출부가 확인하게 강제한다.
 *
 * 손 (T18 → T18 확인) — **두 손 칸은 똑같다.** `slot`을 주면 그 손에 끼고, 다른 손과 짝이 안 맞으면 null이다(fitsSlot).
 * `slot`을 안 주면(가방에서 누름) 알맞은 손을 고르고, 짝이 안 맞는 다른 손은 벗긴다 — 그래서 가방이 차 있으면 못 바꿀 수 있다.
 * 두 손 무기(장검 · 대검 · 활)는 늘 weapon 칸에 들고 다른 손을 비운다.
 */
export function equipItem(save: Save, uid: string, slot?: GearSlot): Save | null {
  const inst = itemByUid(save, uid);
  if (!inst) return null;

  const def = itemDef(inst);
  if (save.player.level < def.level) return null;
  if (slot !== undefined && !fitsSlot(save, def, slot)) return null;
  if (!isHandLine(def.line)) {
    const target = slot ?? def.slot;
    if (!fitsSlot(save, def, target)) return null;
    if (save.equipped[target] === uid) return save;
    return fit(withGear(save, { ...save.equipped, [target]: uid }));
  }

  const partner = handPartner(def.line);
  const target =
    partner === null ? 'weapon' : slot && isHand(slot) ? slot : handFor(save, uid, partner);
  if (save.equipped[target] === uid) return save;
  const equipped = { ...save.equipped, [target]: uid };
  const other = otherHand(target);
  // 다른 손으로 옮겼으면 먼저 손은 비우고, 짝이 안 맞는 다른 손은 벗긴다
  const held = equipped[other] === null ? undefined : itemByUid(save, equipped[other]);
  if (equipped[other] === uid || (held && itemDef(held).line !== partner)) equipped[other] = null;
  return fit(withGear(save, equipped));
}

/** 가방이 넘치면 못 바꾼다 — 벗긴 게 들어갈 자리가 있어야 한다 */
function fit(next: Save): Save | null {
  return bagItems(next).length > next.bag.capacity ? null : next;
}

/**
 * 가방에서 누른 한 손 줄이 들어갈 손 (T18 확인). 짝이 든 손의 반대편 — 비었으면 거기, 차 있으면 갈아 낀다.
 * 짝이 없으면 방패는 offhand, 나머지는 weapon이다(다른 손은 equipItem이 벗긴다).
 */
function handFor(save: Save, uid: string, partner: HandLine): Hand {
  const line = (hand: Hand) => {
    const item = equippedIn(save, hand);
    return item && item.uid !== uid ? itemDef(item).line : null;
  };
  const beside = HANDS.filter((h) => line(otherHand(h)) === partner);
  return (
    beside.find((h) => line(h) === null) ??
    beside[0] ??
    (partner === 'shortsword' ? 'offhand' : 'weapon')
  );
}

/**
 * 그 칸을 비운다. 벗은 건 가방으로 간다 — **가방이 차 있으면 못 벗는다** (T17_2).
 * 낀 장비는 가방 칸을 안 쓰므로, 벗는 순간 한 칸이 필요해진다.
 */
export function unequipSlot(save: Save, slot: GearSlot): Save {
  if (save.equipped[slot] === null || bagFull(save)) return save;
  return withGear(save, { ...save.equipped, [slot]: null });
}

/**
 * 가방을 성능순으로 다시 늘어놓는다 (T17_2).
 * **상태가 아니라 한 번의 동작이다** — 누른 그 시점 기준으로 줄을 세우고,
 * 그 뒤에 얻는 것은 다시 맨 뒤에 붙는다. 또 정리하고 싶으면 다시 누른다.
 */
export function sortInventory(save: Save): Save {
  return { ...save, inventory: [...save.inventory].sort((a, b) => itemPower(b) - itemPower(a)) };
}

/**
 * 최대 HP를 바꾸는 변경을 반영한다 (장착·해제·강화).
 * 늘면 그만큼 현재 HP도 올리고(레벨업과 같은 규칙), 줄면 넘치지 않게 자른다.
 */
export function withStatChange(before: Save, next: Save): Save {
  const was = statsOf(before).maxHp;
  const now = statsOf(next).maxHp;
  const hp = now > was ? before.player.hp + (now - was) : Math.min(before.player.hp, now);
  return { ...next, player: { ...next.player, hp: Math.max(1, hp) } };
}

function withGear(save: Save, equipped: Save['equipped']): Save {
  return withStatChange(save, { ...save, equipped });
}

/**
 * 반지를 낀다 (T17_7). 다른 칸에 같은 반지가 있었으면 그 칸은 비운다 — 한 개를 두 칸에 못 낀다.
 * 없는 uid나 없는 칸이면 null. 반지는 최대 HP를 안 건드려서 HP를 다시 맞출 게 없다.
 */
export function equipRing(save: Save, uid: string, slot: number): Save | null {
  if (!save.rings.some((r) => r.uid === uid) || slot < 0 || slot >= RING_SLOTS) return null;
  return {
    ...save,
    ringSlots: save.ringSlots.map((cur, i) => (i === slot ? uid : cur === uid ? null : cur)),
  };
}

/** 그 반지 칸을 비운다 (T17_7). 반지는 가방 칸을 안 써서 언제든 뺀다 */
export function unequipRing(save: Save, slot: number): Save {
  return { ...save, ringSlots: save.ringSlots.map((cur, i) => (i === slot ? null : cur)) };
}

/** 인벤토리에 넣는다. 상한은 호출부(드랍은 T16)가 본다. */
export function addItem(save: Save, item: Save['inventory'][number]): Save {
  return { ...save, inventory: [...save.inventory, item] };
}

/** 빈 칸에 알아서 끼워 넣는다 — 상점·드랍 직후 "바로 착용" 용도 (§4.5). 두 번째 단검은 왼손으로 간다 */
export function equipAll(save: Save, uids: string[]): Save {
  return uids.reduce<Save>((acc, uid) => equipItem(acc, uid) ?? acc, save);
}

/** 부위 순서대로 훑을 때 쓴다. GEAR_SLOTS를 화면이 직접 import하지 않게 한다. */
export const SLOTS = GEAR_SLOTS;

/**
 * 새 게임 (§4.5). **티어 1 common 풀세트를 입고 시작한다.**
 *
 * 장비가 전투력의 3분의 1인데(GEAR_FLOOR) 첫날 소지금이 0이라, 안 주면 맨몸으로
 * 지역 1을 도는 구간이 생긴다 — 회복비도 못 내고 하루 한두 판밖에 못 도는 구간이다.
 * 지급품은 품질 100% 고정이다. 품질 도박은 상점에서 시작한다.
 */
export function newGame(): Save {
  const base = defaultSave();
  const inventory = gearSetFor(1).map((def, i) => ({
    uid: String(i + 1),
    defId: def.id,
    quality: 1,
    enhance: 0,
  }));
  return equipAll({ ...base, inventory }, inventory.map((i) => i.uid));
}

/**
 * 닉네임이 안 되는 까닭 (T18 확인, 사용자 결정). 되면 null — 한글 완성형 · 영문 · 숫자만, NAME.min~max자.
 * 공백 · 특수문자 · 이모지 · 낱자(ㄱ, ㅏ)는 막는다
 */
export function nameError(name: string): string | null {
  const length = [...name].length;
  if (length < NAME.min || length > NAME.max) return `${NAME.min}~${NAME.max}자로 정해 주세요`;
  if (!/^[가-힣A-Za-z0-9]+$/.test(name)) return '한글 · 영문 · 숫자만 쓸 수 있습니다';
  return null;
}

/** 닉네임을 정한다 (T18 확인). 규칙에 안 맞으면 null */
export function setName(save: Save, name: string): Save | null {
  return nameError(name) ? null : { ...save, player: { ...save.player, name } };
}
