/**
 * 사냥터 한 판 (§4.4) — v5의 핵심 구조.
 *
 * 입장하면 몬스터 2~6마리가 정해지고, **남은 수를 끝까지 안 보여준다.**
 * 그 비공개가 이 시스템의 전부다 — 알면 도박이 아니라 계산이 된다.
 * 개별 보상은 처치 즉시 주고(도망해도 유지), 클리어 보너스만 판돈이다.
 *
 * 화면과 시뮬레이터가 **둘 다 여기를 지난다.** 한쪽이 따로 계산하면 게임이 둘이 된다.
 * React를 import하지 않는다 — Node에서 돌아야 한다.
 */
import {
  consumableById,
  fieldById,
  fieldDropTier,
  gridItem,
  monsterById,
  monstersOfField,
  regionOfField,
  type Monster,
} from '../content';
import type { ItemInstance, Save } from '../save/schema';
import type { Outcome } from './battle';
import {
  BOSS_DROP_RARITY,
  BUFF_STATS,
  CLEAR_BONUS_RATE,
  DROP_RARITY,
  DROP_RATE,
  GEAR_SLOTS,
  GEAR_TIERS,
  GEAR_TIERS_PER_REGION,
  MATERIAL_BUFF,
  materialChance,
  POTION_CARRY_MAX,
  rollRarity,
  rollRunSize,
  withLegendary,
  WP_COST,
} from './formulas';
import { bossDrop, dexDropMult, recordKill, type DexUp } from './dex';
import { chooseMaterials, pickMaterials, potionHeal, spendMaterials } from './economy';
import { bagFull, makeItem, ringBonus } from './items';
import {
  addItem,
  killReward,
  settleBattle,
  statsOf,
  type Reward,
  type Settlement,
} from './progression';
import { spendWp } from './wp';

/** 진행 중인 판. save.run이 null이 아닐 때의 모양이다. */
export type Run = NonNullable<Save['run']>;

/** 마을에 있나 — 창고·여관·상점이 이걸로 판단한다 (§3.7, §4.5). */
export function inTown(save: Save): boolean {
  return save.run === null;
}

/** 사냥터 안에서 쓸 수 있는 물약 총 개수. */
export function carriedPotions(run: Run): number {
  return Object.values(run.potions).reduce((sum, n) => sum + n, 0);
}

function pickMonster(fieldId: string, rng: () => number): Monster {
  const pool = monstersOfField(fieldById(fieldId));
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * 들고 갈 물약을 고른다 (§4.4). **좋은 것부터 최대 3개.**
 * 가진 것보다 많이 못 들고, 엘릭서도 이 3칸에 포함된다.
 */
export function packPotions(save: Save, limit = POTION_CARRY_MAX): Record<string, number> {
  const owned = Object.entries(save.consumables).filter(([, n]) => n > 0);
  // 회복량이 큰 것부터. 엘릭서는 비율 회복이라 맨 뒤로 밀리지 않게 maxHp로 환산한다
  const maxHp = statsOf(save).maxHp;
  const heal = (id: string) => {
    const c = consumableById(id);
    return c.heal + c.healRatio * maxHp;
  };
  const sorted = owned.sort(([a], [b]) => heal(b) - heal(a));

  const packed: Record<string, number> = {};
  let left = limit;
  for (const [id, have] of sorted) {
    if (left <= 0) break;
    const take = Math.min(have, left);
    packed[id] = take;
    left -= take;
  }
  return packed;
}

/**
 * 판을 연다 — 물약을 챙기고 run을 만든다. 사냥터와 보스(T17_5)가 같이 쓴다.
 * 들고 간 만큼 소지품에서 빼고, 안 쓰고 나오면 돌려준다.
 */
export function openRun(save: Save, run: Omit<Run, 'potions'>): Save {
  const packed = packPotions(save);
  const consumables = { ...save.consumables };
  for (const [id, n] of Object.entries(packed)) {
    consumables[id] -= n;
    if (consumables[id] <= 0) delete consumables[id];
  }
  return { ...save, consumables, run: { ...run, potions: packed } };
}

/** 사냥터 입장 WP (§4.1). 나그네의 반지(T17_7)만큼 깎는다 — 모험 탭 버튼도 이 값을 쓴다 */
export function fieldEntryCost(save: Save, region: number): number {
  return Math.round(WP_COST.fieldEntry(region) * (1 - ringBonus(save, 'fieldWp')));
}

/**
 * 사냥터에 들어간다 (§4.4). WP를 내고 마릿수를 뽑는다.
 *
 * **HP 요구치는 없다.** 다쳐서 들어가면 그만큼 위험할 뿐이고, 그 판단이 이 게임이다.
 * 이미 판 안이거나 WP가 모자라면 null — 호출부가 확인하게 강제한다.
 */
export function enterField(save: Save, fieldId: string, rng: () => number): Save | null {
  if (save.run !== null) return null;

  const wp = spendWp(save.wp, fieldEntryCost(save, regionOfField(fieldId).id));
  if (!wp) return null;

  return openRun(
    { ...save, wp },
    {
      fieldId,
      // 사냥꾼의 반지(T17_7)는 6마리 판을 늘린다 — 소재가 더 나온다
      size: rollRunSize(rng, ringBonus(save, 'bigRun')),
      killed: 0,
      earned: { exp: 0, gold: 0 },
      monsterId: pickMonster(fieldId, rng).id,
      boss: false,
      buffs: [],
    },
  );
}

/** 지금 상대할 몬스터. 판 안이 아니면 null. 보스전이면 그 보스다 (T17_5). */
export function currentMonster(save: Save): Monster | null {
  if (!save.run) return null;
  if (save.run.boss) return monsterById(save.run.monsterId);
  const pool = monstersOfField(fieldById(save.run.fieldId));
  return pool.find((m) => m.id === save.run!.monsterId) ?? pool[0];
}

/**
 * 사냥터 안에서 물약을 쓴다 (§4.4). 만피거나 없으면 null.
 *
 * `atHp`는 **전투 재생 중의 현재 HP**다. 전투는 화면에 들어올 때 한 번에 계산해 두고
 * 0.6초마다 재생만 하므로(§4.2), 재생이 끝날 때까지 세이브의 HP는 전투 시작 시점에
 * 멈춰 있다. 전투 화면은 지금 보이는 HP를 넘겨주고, 그 값부터 회복한다.
 *
 * 이름이 usePotion이 아닌 건 lint가 React 훅으로 오해하기 때문이다.
 */
export function drinkPotion(save: Save, id: string, atHp = save.player.hp): Save | null {
  const run = save.run;
  if (!run || (run.potions[id] ?? 0) <= 0) return null;

  const maxHp = statsOf(save).maxHp;
  if (atHp >= maxHp) return null;

  const healed = potionHeal(save, id);
  const potions = { ...run.potions, [id]: run.potions[id] - 1 };
  if (potions[id] <= 0) delete potions[id];

  return {
    ...save,
    player: { ...save.player, hp: Math.min(maxHp, atHp + healed) },
    run: { ...run, potions },
  };
}

/**
 * 판 안에서 소재를 써 버프를 붙인다 (MATERIAL_BUFF, T17_7 검수 5차) — 하나에 하나씩 무작위, 그 판이 끝날 때까지.
 * 사냥터·보스 둘 다 여기를 지난다. 한 판에 3개까지, **지금 지역**의 소재만.
 * `materials`는 개수(알아서 고름 — 시뮬)거나 **고른 소재 목록**(화면)이다. 판 밖이거나 모자라거나 자리가 없으면 null.
 */
export function addBuffs(
  save: Save,
  materials: number | readonly string[],
  rng: () => number = Math.random,
): Save | null {
  const run = save.run;
  if (!run) return null;
  const room = MATERIAL_BUFF.max - run.buffs.length;
  const region = save.regionProgress.current;
  const n = typeof materials === 'number' ? materials : materials.length;
  if (n <= 0 || n > room) return null;
  const used =
    typeof materials === 'number'
      ? pickMaterials(save, region, n, false)
      : chooseMaterials(save, region, n, false, materials);
  if (!used) return null;
  const rolled = used.map(() => BUFF_STATS[Math.floor(rng() * BUFF_STATS.length)]);
  return { ...spendMaterials(save, used), run: { ...run, buffs: [...run.buffs, ...rolled] } };
}

export type RunResult = Settlement & {
  /** 판을 다 깼나 (§4.4) */
  cleared: boolean;
  /** 클리어 보너스. 안 깼으면 0 */
  bonus: Reward;
  /** 얻은 소재의 사냥터 id. 없으면 null */
  material: string | null;
  /** 판이 끝났나 — 완주·도망·사망이면 true, 마을로 돌아간다 */
  over: boolean;
  /** 이번 전투로 주운 장비 (T17_6). 보스는 확정이다 (T17_5) */
  drop: ItemInstance | null;
  /** 떨어졌는데 가방이 차서 못 주웠다 (§4.4) — 화면이 알려준다 */
  dropLost: boolean;
  /** 보스를 쓰러뜨렸나 (T17_5). 이제 다음 지역을 해금할 수 있다 */
  bossCleared: boolean;
  /** 도감 카드 단계가 올랐다 (T19) — 화면이 한 줄로 알린다 */
  dex: DexUp | null;
};

const NONE: Reward = { exp: 0, gold: 0 };

/** 전투 결과에 드랍 칸의 기본값. 대부분의 전투는 아무것도 안 떨군다 */
const NO_DROP = { drop: null, dropLost: false, bossCleared: false, dex: null } as const;

type Given = { save: Save; drop: ItemInstance | null; lost: boolean };

/** 장비를 가방에 넣는다. 차 있으면 못 줍는다 — 사냥은 그대로 이어진다 (§4.4) */
function give(save: Save, defId: string, rng: () => number): Given {
  if (bagFull(save)) return { save, drop: null, lost: true };
  const item = makeItem(save.inventory, defId, rng);
  return { save: addItem(save, item), drop: item, lost: false };
}

/**
 * 몬스터 한 마리의 장비 드랍 (T17_6). 기본 3% × LUK 배율 × 도감 배율(10마리부터, T19)
 * × 그 지역 보스 카드(2번, T19 검수 3차), 처치마다 한 번. 보스 카드 5번이면 전설 비율도 ×1.5다.
 * **부위는 몬스터가, 티어는 사냥터가 정한다** — 같은 몬스터라도 어디서 잡았느냐에 따라
 * 티어가 다를 수 있고, 사냥터마다 나오는 부위가 정해진다.
 */
function rollDrop(save: Save, monster: Monster, fieldId: string, rng: () => number): Given {
  const boss = bossDrop(save, regionOfField(fieldId).id);
  const rate = DROP_RATE * statsOf(save).dropMult * dexDropMult(save, monster) * boss.drop;
  if (!monster.drop || rng() >= rate) return { save, drop: null, lost: false };
  const tier = fieldDropTier(fieldById(fieldId));
  const rarity = rollRarity(withLegendary(DROP_RARITY, boss.legend), rng);
  return give(save, gridItem(tier, monster.drop, rarity).id, rng);
}

/**
 * 보스전 정산 (T17_5). 1:1이라 클리어 보너스·소재가 없다 — 대신 보상을 ×0.54 없이 통째로 주고
 * **장비 하나를 확정으로** 준다. 티어는 다음 지역 앞단(보스를 잡는 레벨에서 바로 낄 수 있다),
 * 등급은 rare 이상, 부위는 무작위다. 지거나 나가도 도전 비용은 돌아오지 않는다 —
 * 들어갈 때 이미 'tried'로 적어 뒀으니 다음은 재도전 값이다.
 */
function settleBoss(
  save: Save,
  run: Run,
  outcome: Outcome,
  playerHp: number,
  rng: () => number,
  now: number,
): RunResult {
  const boss = currentMonster(save)!;
  const done = { cleared: false, bonus: NONE, material: null, over: true };

  if (outcome !== 'win') {
    const settled = settleBattle(save, outcome, playerHp, NONE, now);
    const back = { ...settled.save, consumables: returnPotions(settled.save, run), run: null };
    return { ...settled, ...done, ...NO_DROP, save: back };
  }

  const stats = statsOf(save);
  const reward = {
    exp: Math.round(boss.exp * stats.expMult),
    gold: Math.round(boss.gold * stats.goldMult),
  };
  const won = settleBattle(save, 'win', playerHp, reward, now);
  const dex = recordKill(won.save, boss);
  const settled = { ...won, save: dex.save };

  // 재사냥 (T19 검수) — EXP · 골드와 도감 한 단계만. 장비와 해금은 첫 처치 한 번이다.
  // 재도전 값에 보스 한 마리 보상이라 WP당 그 지역 사냥보다도 한참 덜 번다 (balance.md 7장) — 추억과 도감용
  if (save.regionProgress.bosses[boss.region] === 'cleared') {
    const back = { ...settled.save, consumables: returnPotions(settled.save, run), run: null };
    return { ...settled, ...done, ...NO_DROP, save: back, dex: dex.up };
  }

  const progress = {
    ...settled.save.regionProgress,
    bosses: { ...settled.save.regionProgress.bosses, [boss.region]: 'cleared' as const },
  };
  const tier = Math.min(GEAR_TIERS, boss.region * GEAR_TIERS_PER_REGION + 1);
  const slot = GEAR_SLOTS[Math.floor(rng() * GEAR_SLOTS.length)];
  const item = gridItem(tier, slot, rollRarity(BOSS_DROP_RARITY, rng));
  const given = give({ ...settled.save, regionProgress: progress }, item.id, rng);

  return {
    ...settled,
    ...done,
    save: { ...given.save, consumables: returnPotions(given.save, run), run: null },
    drop: given.drop,
    dropLost: given.lost,
    bossCleared: true,
    dex: dex.up,
  };
}

/** 안 쓰고 남은 물약을 소지품으로 돌려준다. 판이 끝날 때마다 부른다. */
function returnPotions(save: Save, run: Run): Save['consumables'] {
  const consumables = { ...save.consumables };
  for (const [id, n] of Object.entries(run.potions)) {
    if (n > 0) consumables[id] = (consumables[id] ?? 0) + n;
  }
  return consumables;
}

/**
 * 전투 하나의 결과를 판에 반영한다 (§4.4).
 *
 *   win   개별 보상 즉시 지급. 다 잡았으면 클리어 보너스 + 소재, 아니면 다음 몬스터
 *   flee  개별 보상은 그대로 두고 판만 끝낸다. **보너스만 잃는다**
 *   lose  거기에 소지 골드 10%까지 (창고는 면제, §4.5)
 */
export function settleRun(
  save: Save,
  outcome: Outcome,
  playerHp: number,
  rng: () => number,
  now: number,
): RunResult {
  const run = save.run;
  if (!run) throw new Error('판 안이 아닌데 settleRun을 불렀다');
  if (run.boss) return settleBoss(save, run, outcome, playerHp, rng, now);

  const monster = currentMonster(save)!;

  if (outcome !== 'win') {
    const settled = settleBattle(save, outcome, playerHp, NONE, now);
    return {
      ...settled,
      save: { ...settled.save, consumables: returnPotions(settled.save, run), run: null },
      cleared: false,
      bonus: NONE,
      material: null,
      over: true,
      ...NO_DROP,
    };
  }

  const stats = statsOf(save);
  const gained = killReward(monster, stats.goldMult, stats.expMult);
  const won = settleBattle(save, 'win', playerHp, gained, now);
  // 도감에 한 마리 (T19). 10번째부터 아래 드랍이 는다
  const dex = recordKill(won.save, monster);
  // 드랍은 처치 즉시 들어온다 — 개별 보상처럼 도망·사망해도 남는다 (T17_6)
  const loot = rollDrop(dex.save, monster, run.fieldId, rng);
  const settled = { ...won, save: loot.save };
  const dropped = { drop: loot.drop, dropLost: loot.lost, bossCleared: false, dex: dex.up };
  const killed = run.killed + 1;
  const earned = { exp: run.earned.exp + gained.exp, gold: run.earned.gold + gained.gold };

  // 아직 남았다 — 다음 몬스터를 뽑고 판을 이어간다
  if (killed < run.size) {
    return {
      ...settled,
      save: { ...settled.save, run: { ...run, killed, earned, monsterId: pickMonster(run.fieldId, rng).id } },
      cleared: false,
      bonus: NONE,
      material: null,
      over: false,
      ...dropped,
    };
  }

  // 완주 — 클리어 보너스 = 개별 합 × 0.2 × 마릿수 (§4.4). 정복자의 반지(T17_7)가 더 얹는다
  const rate = CLEAR_BONUS_RATE * run.size * (1 + ringBonus(save, 'clearBonus'));
  const bonus: Reward = {
    exp: Math.round(earned.exp * rate),
    gold: Math.round(earned.gold * rate),
  };
  const withBonus = settleBattle(settled.save, 'win', playerHp, bonus, now);

  // 소재 — 6마리 확정, 5마리 50%, 4마리 20% × 드랍 배율 (§4.4, T17_7 검수 4차)
  const chance = materialChance(run.size, statsOf(save).dropMult);
  const material = chance > 0 && (chance >= 1 || rng() < chance) ? run.fieldId : null;
  const materials = material
    ? { ...withBonus.save.materials, [material]: (withBonus.save.materials[material] ?? 0) + 1 }
    : withBonus.save.materials;

  return {
    save: {
      ...withBonus.save,
      materials,
      consumables: returnPotions(withBonus.save, run),
      run: null,
    },
    outcome: 'win',
    gained: {
      exp: settled.gained.exp + withBonus.gained.exp,
      gold: settled.gained.gold + withBonus.gained.gold,
    },
    levelsGained: settled.levelsGained + withBonus.levelsGained,
    goldLost: 0,
    cleared: true,
    bonus,
    material,
    over: true,
    ...dropped,
  };
}
