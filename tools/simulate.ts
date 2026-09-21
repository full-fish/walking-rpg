/**
 * 밸런스 시뮬레이터 (§6). 하루 플레이를 레벨 50까지 반복해서 돌린다.
 *
 * 전투는 battle.ts를, 정산은 progression.ts를 그대로 호출한다. 여기서 따로 계산하는
 * 순간 게임이 둘이 된다 — 시뮬레이터가 통과해도 실제 게임은 다를 수 있게 된다.
 *
 * 한 판 진행(마릿수 뽑기 → 반복 전투 → 클리어 보너스)은 §4.4를 여기서 모델링한다.
 * T16이 app/field.tsx를 만들 때 src/game/field.ts로 옮겨가고, 여기는 그걸 부르게 된다.
 */
import { gearSetFor, monstersOfField, REGIONS, type Field, type Region } from '../src/content';
import { makeRng, simulateBattle, type Combatant } from '../src/game/battle';
import {
  CLEAR_BONUS_RATE,
  expToNext,
  MIDNIGHT_WP,
  rollRunSize,
  SPENDABLE_STATS,
  WP_COST,
  type SpendableStat,
} from '../src/game/formulas';
import { itemDef, makeItem } from '../src/game/items';
import {
  addItem,
  equipItem,
  killReward,
  settleBattle,
  statsOf,
  type Reward,
} from '../src/game/progression';
import { defaultSave, type Save } from '../src/save/schema';

type StatPoints = Save['statPoints'];

/** 스탯 포인트를 어디에 넣는지. 가중치 비율대로 나눈다 (§4.3). */
export type Build = { name: string; weights: Record<SpendableStat, number> };

/** §4.3 스탯 4종을 여러 비율로 — 몰빵만이 아니라 편중·균형 배분까지 본다. */
export const BUILDS: Build[] = [
  { name: '균등', weights: { str: 1, vit: 1, agi: 1, luk: 1 } },
  { name: '힘 몰빵', weights: { str: 1, vit: 0, agi: 0, luk: 0 } },
  { name: '민첩 몰빵', weights: { str: 0, vit: 0, agi: 1, luk: 0 } },
  { name: '체력 몰빵', weights: { str: 0, vit: 1, agi: 0, luk: 0 } },
  { name: '행운 몰빵', weights: { str: 0, vit: 0, agi: 0, luk: 1 } },
  { name: '힘 편중', weights: { str: 2, vit: 1, agi: 1, luk: 0 } },
  { name: '민첩 편중', weights: { str: 1, vit: 1, agi: 2, luk: 0 } },
  { name: '체력 편중', weights: { str: 1, vit: 2, agi: 1, luk: 0 } },
  { name: '힘·체력', weights: { str: 1, vit: 1, agi: 0, luk: 0 } },
  { name: '힘·민첩', weights: { str: 1, vit: 0, agi: 1, luk: 0 } },
  { name: '전투 3종', weights: { str: 2, vit: 2, agi: 2, luk: 1 } },
];

const STATS = SPENDABLE_STATS;

/**
 * 남은 포인트를 가중치 비율대로 넣는다.
 * 비율이 딱 안 나눠떨어지면 "지금까지 쓴 것 중 비율에 가장 모자란 스탯"에 한 점씩 준다.
 *
 * 기준은 **지금까지 쓴 누적 합**이다. 레벨당 3점씩 들어오는데 호출마다 0에서 다시 세면
 * 4번째 스탯(행운)에는 영영 한 점도 안 가고, 비율이 다른 빌드가 전부 같은 결과가 된다.
 */
function allocate(spend: StatPoints, build: Build, points: number): StatPoints {
  const next = { ...spend };
  const totalWeight = STATS.reduce((sum, k) => sum + build.weights[k], 0);

  for (let i = 0; i < points; i++) {
    const givenTotal = STATS.reduce((sum, k) => sum + next[k], 0) + 1;
    let best: SpendableStat = STATS.find((k) => build.weights[k] > 0) ?? 'str';
    let bestGap = -Infinity;
    for (const k of STATS) {
      if (build.weights[k] === 0) continue;
      const gap = (build.weights[k] / totalWeight) * givenTotal - next[k];
      if (gap > bestGap) {
        bestGap = gap;
        best = k;
      }
    }
    next[best] += 1;
  }
  return { ...next, unspent: 0 };
}

/** 그 사냥터를 돌 만한 레벨 (T11 벤치와 같은 기준). */
export function properLevel(region: Region, field: Field): number {
  const avgTier = field.pool.reduce((sum, [, t]) => sum + t, 0) / field.pool.length;
  const [loT, hiT] = region.tierBand;
  const [loL, hiL] = region.levelRange;
  return Math.round(loL + ((avgTier - loT) / (hiT - loT)) * (hiL - loL));
}

/** 지금 레벨로 갈 수 있는 사냥터 중 가장 센 곳. 플레이어는 보통 이렇게 고른다. */
function pickField(region: Region, level: number): Field {
  const sorted = [...region.fields].sort((a, b) => properLevel(region, a) - properLevel(region, b));
  const unlocked = sorted.filter((f) => properLevel(region, f) <= level);
  return unlocked.at(-1) ?? sorted[0];
}

function regionOf(level: number): Region {
  return REGIONS.find((r) => level <= r.levelRange[1]) ?? REGIONS.at(-1)!;
}

/** §4.5 물약 — 그 지역에서 살 수 있는 가장 좋은 것. 휴대 3개 (§4.4). */
const POTIONS = [
  { region: 1, heal: 100, cost: 100 },
  { region: 2, heal: 180, cost: 200 },
  { region: 3, heal: 300, cost: 320 },
  { region: 4, heal: 450, cost: 450 },
  { region: 5, heal: 650, cost: 600 },
];
const POTIONS_PER_RUN = 3;
/** HP가 이 아래로 떨어지면 물약을 쓴다. */
const POTION_THRESHOLD = 0.35;

export type RunResult = {
  reward: Reward;
  kills: number;
  cleared: boolean;
  died: boolean;
  /** 그 판에서 쓴 물약 값 (§4.5). 골드는 장비로 나가므로 공짜로 두면 안 된다 */
  potionCost: number;
};

/**
 * 살 수 있는 가장 좋은 common 풀세트로 갈아입는다 (§4.5).
 *
 * 밸런스 기준선은 **그 지역 common 풀세트**다 — 등급·품질·강화는 전부 그 위의 이득이라
 * 시뮬은 기준선만 본다. 돈이 모자라면 중요한 부위부터 한 점씩 산다.
 */
export function buyGear(save: Save, rng: () => number): Save {
  const set = gearSetFor(save.player.level);
  const worn = save.equipped.weapon;
  const wornTier = worn ? itemDef(save.inventory.find((i) => i.uid === worn)!).tier : 0;
  if (set.length === 0 || set[0].tier <= wornTier) return save;

  // 무기·갑옷이 스탯의 절반을 갖고 있다 (§4.5 SLOT_BIAS). 돈이 모자라면 이 순서로 산다
  const order = ['weapon', 'armor', 'helm', 'gloves', 'boots', 'accessory'];
  let next = save;
  for (const def of [...set].sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot))) {
    if (next.player.gold < def.price) break;
    const item = makeItem(next.inventory, def.id, rng);
    next = addItem(next, item);
    next = { ...next, player: { ...next.player, gold: next.player.gold - def.price } };
    next = equipItem(next, item.uid) ?? next;
  }
  return next;
}

/**
 * 사냥터 한 판 (§4.4). 마릿수를 뽑고 그만큼 연속으로 싸운다.
 * 도망은 모델링하지 않는다 — "끝까지 간다"가 가장 불리한 경우라 하한을 본다.
 */
export function simulateRun(save: Save, rng: () => number): RunResult {
  const region = regionOf(save.player.level);
  const field = pickField(region, save.player.level);
  const pool = monstersOfField(field);
  const potion = POTIONS[region.id - 1];

  const size = rollRunSize(rng);
  const stats = statsOf(save);
  let hp = save.player.hp;
  let potions = POTIONS_PER_RUN;
  let potionCost = 0;
  const individual: Reward = { exp: 0, gold: 0 };
  let kills = 0;

  for (let i = 0; i < size; i++) {
    if (hp < stats.maxHp * POTION_THRESHOLD && potions > 0) {
      potions -= 1;
      potionCost += potion.cost;
      hp = Math.min(stats.maxHp, hp + potion.heal);
    }
    const monster = pool[Math.floor(rng() * pool.length)];
    const player: Combatant = { name: '', hp, ...stats };
    const result = simulateBattle(player, { ...monster, hp: monster.maxHp }, rng);
    if (result.outcome !== 'win')
      return { reward: individual, kills, cleared: false, died: true, potionCost };

    hp = result.playerHp;
    kills += 1;
    const got = killReward(monster);
    individual.exp += got.exp;
    individual.gold += got.gold;
  }

  // 다 잡았을 때만 붙는 보너스 (§4.4). 도망·사망하면 개별 보상만 남는다
  const bonus = CLEAR_BONUS_RATE * size;
  return {
    reward: {
      exp: Math.round(individual.exp * (1 + bonus)),
      gold: Math.round(individual.gold * (1 + bonus)),
    },
    kills,
    cleared: true,
    died: false,
    potionCost,
  };
}

export type DayLog = {
  day: number;
  level: number;
  /** 그날 번 골드. §6.3의 "하루 골드"는 수입이지 잔고 증감이 아니다 */
  gold: number;
  /** 사망으로 잃은 골드. 창고에 넣어두면 면제되지만 창고는 T14다 (§4.5) */
  goldLost: number;
  exp: number;
  kills: number;
  entries: number;
  deaths: number;
  clearRate: number;
};

export type SimOptions = { steps: number; build: Build; maxLevel: number; maxDays: number };

/**
 * 하루치를 돌린다. 걸음이 WP가 되고, WP가 사냥터 입장이 되고, 입장이 보상이 된다 (§4.1, §6.1).
 * 남은 WP는 다음 날로 넘어간다 — 상한이 없다 (§4.1).
 */
export function simulate(opts: SimOptions, seed = 1) {
  const rng = makeRng(seed);
  let save: Save = defaultSave();
  let wp = 0;
  let spentOnGates = 0;
  let spentOnPotions = 0;
  let spentOnGear = 0;
  const log: DayLog[] = [];

  for (let day = 1; day <= opts.maxDays && save.player.level < opts.maxLevel; day++) {
    wp += opts.steps + MIDNIGHT_WP;

    const region = regionOf(save.player.level);
    // 다음 지역 해금 — 레벨이 닿으면 관문 비용을 낸다 (§4.1)
    const next = REGIONS.find((r) => r.id === region.id + 1);
    if (next && save.player.level >= next.levelRange[0]) {
      const gate = WP_COST.regionUnlock(region.id) + WP_COST.bossFirst(region.id);
      if (wp >= gate) {
        wp -= gate;
        spentOnGates += gate;
      }
    }

    const entryCost = WP_COST.fieldEntry(regionOf(save.player.level).id);
    let entries = 0;
    let kills = 0;
    let deaths = 0;
    let cleared = 0;
    let earned = 0;
    let lost = 0;
    const before = { exp: save.player.exp, level: save.player.level };

    while (wp >= entryCost) {
      wp -= entryCost;
      entries += 1;
      const run = simulateRun(save, rng);
      kills += run.kills;
      if (run.cleared) cleared += 1;
      if (run.died) deaths += 1;

      const now = day * 86_400_000;
      // 개별 보상은 죽어도 남는다 (§4.4). 잃는 건 클리어 보너스와 골드 10%다
      save = settleBattle(save, 'win', statsOf(save).maxHp, run.reward, now).save;
      earned += run.reward.gold;
      save = {
        ...save,
        player: { ...save.player, gold: Math.max(0, save.player.gold - run.potionCost) },
      };
      spentOnPotions += run.potionCost;
      if (run.died) {
        const dead = settleBattle(save, 'lose', 0, { exp: 0, gold: 0 }, now);
        lost += dead.goldLost;
        save = dead.save;
      }
      // 레벨업으로 생긴 포인트는 빌드 비율대로 즉시 쓴다
      if (save.statPoints.unspent > 0) {
        save = { ...save, statPoints: allocate(save.statPoints, opts.build, save.statPoints.unspent) };
      }
      // 살 수 있는 장비가 생겼으면 바로 갈아입는다 (§4.5). 전투력의 대부분이 여기서 온다
      const beforeGold = save.player.gold;
      save = buyGear(save, rng);
      spentOnGear += beforeGold - save.player.gold;

      // 판이 끝나면 마을에서 회복한다 (여관, §4.5). HP를 이어가는 건 판 안에서만이다
      save = { ...save, player: { ...save.player, hp: statsOf(save).maxHp } };
    }

    const gainedExp =
      save.player.level > before.level
        ? save.player.exp + expBetween(before.level, save.player.level) - before.exp
        : save.player.exp - before.exp;

    log.push({
      day,
      level: save.player.level,
      gold: earned,
      goldLost: lost,
      exp: gainedExp,
      kills,
      entries,
      deaths,
      clearRate: entries > 0 ? cleared / entries : 0,
    });
  }

  return { save, log, spentOnGates, spentOnPotions, spentOnGear, days: log.length };
}

/** from레벨에서 to레벨까지 올리는 데 든 EXP 총합. 하루 EXP를 역산할 때 쓴다. */
function expBetween(from: number, to: number): number {
  let sum = 0;
  for (let l = from; l < to; l++) sum += expToNext(l);
  return sum;
}

/** 그 레벨에 처음 도달한 날. 못 찍었으면 undefined. */
export function dayAtLevel(log: DayLog[], level: number): number | undefined {
  return log.find((d) => d.level >= level)?.day;
}
