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
  monstersOfField,
  regionOfField,
  type Monster,
} from '../content';
import type { Save } from '../save/schema';
import type { Outcome } from './battle';
import {
  CLEAR_BONUS_RATE,
  MATERIAL_GUARANTEED_SIZE,
  POTION_CARRY_MAX,
  rollRunSize,
  WP_COST,
} from './formulas';
import { killReward, settleBattle, statsOf, type Reward, type Settlement } from './progression';
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
 * 사냥터에 들어간다 (§4.4). WP를 내고 마릿수를 뽑는다.
 *
 * **HP 요구치는 없다.** 다쳐서 들어가면 그만큼 위험할 뿐이고, 그 판단이 이 게임이다.
 * 이미 판 안이거나 WP가 모자라면 null — 호출부가 확인하게 강제한다.
 */
export function enterField(save: Save, fieldId: string, rng: () => number): Save | null {
  if (save.run !== null) return null;

  const wp = spendWp(save.wp, WP_COST.fieldEntry(regionOfField(fieldId).id));
  if (!wp) return null;

  const packed = packPotions(save);
  // 들고 간 만큼 창고(소지품)에서 뺀다. 안 쓰고 나오면 돌려준다
  const consumables = { ...save.consumables };
  for (const [id, n] of Object.entries(packed)) {
    consumables[id] -= n;
    if (consumables[id] <= 0) delete consumables[id];
  }

  return {
    ...save,
    wp,
    consumables,
    run: {
      fieldId,
      size: rollRunSize(rng),
      killed: 0,
      earned: { exp: 0, gold: 0 },
      potions: packed,
      monsterId: pickMonster(fieldId, rng).id,
    },
  };
}

/** 지금 상대할 몬스터. 판 안이 아니면 null. */
export function currentMonster(save: Save): Monster | null {
  if (!save.run) return null;
  const pool = monstersOfField(fieldById(save.run.fieldId));
  return pool.find((m) => m.id === save.run!.monsterId) ?? pool[0];
}

/**
 * 사냥터 안에서 물약을 쓴다 (§4.4). 만피거나 없으면 null.
 * 이름이 drinkPotion이 아닌 건 lint가 React 훅으로 오해하기 때문이다.
 */
export function drinkPotion(save: Save, id: string): Save | null {
  const run = save.run;
  if (!run || (run.potions[id] ?? 0) <= 0) return null;

  const maxHp = statsOf(save).maxHp;
  if (save.player.hp >= maxHp) return null;

  const def = consumableById(id);
  const healed = def.heal + Math.round(maxHp * def.healRatio);
  const potions = { ...run.potions, [id]: run.potions[id] - 1 };
  if (potions[id] <= 0) delete potions[id];

  return {
    ...save,
    player: { ...save.player, hp: Math.min(maxHp, save.player.hp + healed) },
    run: { ...run, potions },
  };
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
};

const NONE: Reward = { exp: 0, gold: 0 };

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
    };
  }

  const stats = statsOf(save);
  const gained = killReward(monster, stats.goldFind);
  const settled = settleBattle(save, 'win', playerHp, gained, now);
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
    };
  }

  // 완주 — 클리어 보너스 = 개별 합 × 0.2 × 마릿수 (§4.4)
  const rate = CLEAR_BONUS_RATE * run.size;
  const bonus: Reward = {
    exp: Math.round(earned.exp * rate),
    gold: Math.round(earned.gold * rate),
  };
  const withBonus = settleBattle(settled.save, 'win', playerHp, bonus, now);

  // 6마리는 확정, 그 아래는 행운(dropRate)으로만 나온다 (§4.3, §4.4)
  const lucky = run.size >= MATERIAL_GUARANTEED_SIZE || rng() < stats.dropRate;
  const material = lucky ? run.fieldId : null;
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
  };
}
