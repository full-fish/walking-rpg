/**
 * 밸런스 시뮬레이터 (§6). 하루 플레이를 레벨 50까지 반복해서 돌린다.
 *
 * 전투는 battle.ts를, 정산은 progression.ts를 그대로 호출한다. 여기서 따로 계산하는
 * 순간 게임이 둘이 된다 — 시뮬레이터가 통과해도 실제 게임은 다를 수 있게 된다.
 *
 * 한 판 진행(마릿수 뽑기 → 반복 전투 → 클리어 보너스)은 §4.4를 여기서 모델링한다.
 * T16이 app/field.tsx를 만들 때 src/game/field.ts로 옮겨가고, 여기는 그걸 부르게 된다.
 */
import {
  CONSUMABLES,
  gearSetFor,
  monstersOfField,
  REGIONS,
  type Field,
  type Region,
} from '../src/content';
import { makeRng, simulateBattle, type Combatant } from '../src/game/battle';
import { buyConsumable, sellItem, stayInn } from '../src/game/economy';
import { currentMonster, drinkPotion, enterField, settleRun } from '../src/game/field';
import {
  expToNext,
  MIDNIGHT_WP,
  POTION_CARRY_MAX,
  SPENDABLE_STATS,
  WP_COST,
  type SpendableStat,
} from '../src/game/formulas';
import { itemDef, makeItem } from '../src/game/items';
import { addItem, applyRegen, equipItem, newGame, statsOf } from '../src/game/progression';
import type { Save } from '../src/save/schema';

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

/**
 * 어디서 사냥할까. 보통은 **갈 수 있는 곳 중 제일 센 곳**이다 — 보상이 제일 크니까.
 *
 * `cautious`면 제일 쉬운 곳으로 내려간다. 회복할 돈이 없을 때 쓰는 길이다 —
 * 안 넣으면 "돈이 없어 못 고치고, 못 고쳐서 못 버는" 악순환에 갇힌다
 * (힘 몰빵이 시드 하나에서 Lv48에 400일을 갇혔다). 실제 플레이어는 내려간다.
 */
function pickField(region: Region, level: number, cautious = false): Field {
  const sorted = [...region.fields].sort((a, b) => properLevel(region, a) - properLevel(region, b));
  if (cautious) return sorted[0];
  const unlocked = sorted.filter((f) => properLevel(region, f) <= level);
  return unlocked.at(-1) ?? sorted[0];
}

function regionOf(level: number): Region {
  return REGIONS.find((r) => level <= r.levelRange[1]) ?? REGIONS.at(-1)!;
}

/**
 * 살 수 있는 가장 좋은 common 풀세트로 갈아입는다 (§4.5).
 *
 * 밸런스 기준선은 **그 지역 common 풀세트**다 — 등급·품질·강화는 전부 그 위의 이득이라
 * 시뮬은 기준선만 본다. 돈이 모자라면 중요한 부위부터 한 점씩 산다.
 */
export function buyGear(save: Save, rng: () => number): Save {
  const set = gearSetFor(save.player.level);

  // **사는 순서가 의미를 갖는다** (T16_1). 부위마다 성격이 갈린 뒤로 무기는 ATK만 주므로,
  // 무기부터 사면 더 세게 때리면서 더 빨리 죽는다. 버티는 부위를 먼저 산다.
  const order = ['armor', 'helm', 'boots', 'weapon', 'gloves', 'accessory'];
  let next = save;
  for (const def of [...set].sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot))) {
    const worn = next.equipped[def.slot];
    const wornTier = worn ? itemDef(next.inventory.find((i) => i.uid === worn)!).tier : 0;
    // 못 산 부위는 다음 날 다시 본다. 하루 돈이 모자랐다고 다음 티어까지 그 칸을 비워두면
    // 실제 플레이와 다르다 — 사람은 이틀에 걸쳐 갖춰 입는다
    if (def.tier <= wornTier || next.player.gold < def.price) continue;
    const item = makeItem(next.inventory, def.id, rng);
    next = addItem(next, item);
    next = { ...next, player: { ...next.player, gold: next.player.gold - def.price } };
    next = equipItem(next, item.uid) ?? next;
    // 갈아입은 구 장비는 판다 (§4.5). 안 팔면 가방 20칸이 열 티어를 못 버틴다 —
    // 실제로도 가방을 늘리거나 파는 것 중 하나는 해야 한다 (T17_2)
    if (worn) next = sellItem(next, worn) ?? next;
  }
  return next;
}

/** 그 지역에서 살 수 있는 가장 좋은 물약 (§4.5). 콘텐츠를 그대로 읽는다. */
function bestPotion(region: number) {
  return CONSUMABLES.filter((c) => c.region <= region && c.heal > 0).at(-1)!;
}

/** 들고 갈 물약을 3개까지 채운다 (§4.4). 돈이 모자라면 살 수 있는 만큼만. */
function restock(save: Save, region: number): { save: Save; spent: number } {
  const potion = bestPotion(region);
  let next = save;
  let spent = 0;
  while (
    Object.values(next.consumables).reduce((sum, n) => sum + n, 0) < POTION_CARRY_MAX &&
    next.player.gold >= potion.price
  ) {
    next = buyConsumable(next, potion.id)!;
    spent += potion.price;
  }
  return { save: next, spent };
}

/** HP가 이 아래면 여관에 묵는다. 반쯤 죽은 채로 들어가면 그 판을 통째로 버린다. */
const INN_THRESHOLD = 0.5;
/** 판 안에서 HP가 이 아래로 떨어지면 물약을 쓴다. */
const POTION_THRESHOLD = 0.35;
/**
 * 이보다 다쳤는데 회복할 돈도 없으면 **오늘은 쉰다** (§4.1).
 * WP는 상한이 없어서 내일로 넘어간다 — 자연회복이 그동안 채운다.
 */
const ENTER_THRESHOLD = 0.3;
/**
 * 물약이 다 떨어지고 이보다 다쳤으면 **도망친다** (§4.4).
 * 개별 보상은 지키고 클리어 보너스만 버린다 — 이 판단이 몰이사냥의 전부다.
 * 안 넣으면 "끝까지 간다"가 되어 후반 사망이 실제보다 훨씬 많이 나온다.
 */
const FLEE_THRESHOLD = 0.3;

/** 다쳤으면 여관에 묵는다 (§4.5). 자연회복만으로는 하루 6~9판을 못 버틴다. */
function rest(save: Save, region: Region, now: number): { save: Save; spent: number } {
  const maxHp = statsOf(save).maxHp;
  if (save.player.hp >= maxHp * INN_THRESHOLD) return { save, spent: 0 };

  const rested = stayInn(save, region.town.inn, now);
  return rested ? { save: rested, spent: region.town.inn } : { save, spent: 0 };
}

export type DayLog = {
  day: number;
  level: number;
  /** 그날 번 골드. §6.3의 "하루 골드"는 수입이지 잔고 증감이 아니다 */
  gold: number;
  /** 사망으로 잃은 골드. 창고를 쓰면 면제된다 — 시뮬은 안 쓴다(가장 불리한 경우) */
  goldLost: number;
  /** 그날 물약에 쓴 골드 (§4.5 유지비) */
  potionCost: number;
  /** 그날 여관에 쓴 골드 (§4.5 유지비) */
  innCost: number;
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
  let save: Save = newGame();
  let spentOnGates = 0;
  let spentOnPotions = 0;
  let spentOnInn = 0;
  let spentOnGear = 0;
  const log: DayLog[] = [];

  for (let day = 1; day <= opts.maxDays && save.player.level < opts.maxLevel; day++) {
    save = { ...save, wp: { ...save.wp, current: save.wp.current + opts.steps + MIDNIGHT_WP } };

    const region = regionOf(save.player.level);
    // 다음 지역 해금 — 레벨이 닿으면 관문 비용을 낸다 (§4.1)
    const next = REGIONS.find((r) => r.id === region.id + 1);
    if (next && save.player.level >= next.levelRange[0]) {
      const gate = WP_COST.regionUnlock(region.id) + WP_COST.bossFirst(region.id);
      if (save.wp.current >= gate) {
        save = { ...save, wp: { ...save.wp, current: save.wp.current - gate } };
        spentOnGates += gate;
      }
    }

    const today = {
      entries: 0,
      kills: 0,
      deaths: 0,
      fled: 0,
      cleared: 0,
      gold: 0,
      lost: 0,
      potion: 0,
      inn: 0,
    };
    const before = { exp: save.player.exp, level: save.player.level };
    const dayStart = day * 86_400_000;

    for (;;) {
      const here = regionOf(save.player.level);
      if (save.wp.current < WP_COST.fieldEntry(here.id)) break;

      // 하루 안에서도 시간이 흐른다 — 입장 사이에 자연회복이 조금씩 붙는다 (§4.2).
      // 하루 7판이면 판 사이가 3시간쯤이고 최대 HP의 20%가 찬다. 나머지는 돈으로 메운다.
      const now = dayStart + Math.round((today.entries * 86_400_000) / 9);
      save = applyRegen(save, now);

      // 마을에서 할 일 — 장비 갈아입기, 물약 채우기, 너무 다쳤으면 여관
      const goldBefore = save.player.gold;
      save = buyGear(save, rng);
      spentOnGear += goldBefore - save.player.gold;

      const stocked = restock(save, here.id);
      save = stocked.save;
      today.potion += stocked.spent;

      const rested = rest(save, here, now);
      save = rested.save;
      today.inn += rested.spent;

      // 다쳤는데 여관도 못 가면 오늘은 접는다. WP는 내일로 넘어간다 (§4.1)
      if (save.player.hp < statsOf(save).maxHp * ENTER_THRESHOLD) break;

      // 회복할 돈이 없으면 쉬운 사냥터로 내려가 밑천을 다시 만든다
      const broke = save.player.gold < here.town.inn;
      const entered = enterField(save, pickField(here, save.player.level, broke).id, rng);
      if (!entered) break;
      save = entered;
      today.entries += 1;

      // 판 안 — 물약을 쓰고, 그래도 위험하면 도망친다 (§4.4)
      for (;;) {
        const stats = statsOf(save);
        if (save.player.hp < stats.maxHp * POTION_THRESHOLD) {
          const potion = Object.keys(save.run!.potions)[0];
          if (potion) save = drinkPotion(save, potion) ?? save;
        }

        // 물약도 없고 반쯤 죽었으면 챙긴 것만 들고 나온다.
        // 죽으면 소지 골드 10%까지 잃으니, 보너스를 포기하는 게 싸다
        if (
          save.player.hp < stats.maxHp * FLEE_THRESHOLD &&
          Object.keys(save.run!.potions).length === 0
        ) {
          save = settleRun(save, 'flee', save.player.hp, rng, now).save;
          today.fled += 1;
          break;
        }

        const monster = currentMonster(save)!;
        const player: Combatant = { name: '', hp: save.player.hp, ...statsOf(save) };
        const battle = simulateBattle(player, { ...monster, hp: monster.maxHp }, rng);

        const result = settleRun(save, battle.outcome, battle.playerHp, rng, now);
        save = result.save;
        today.gold += result.gained.gold;
        today.lost += result.goldLost;
        if (battle.outcome === 'win') today.kills += 1;
        if (result.cleared) today.cleared += 1;
        if (battle.outcome === 'lose') today.deaths += 1;

        // 레벨업으로 생긴 포인트는 빌드 비율대로 즉시 쓴다
        if (save.statPoints.unspent > 0) {
          save = {
            ...save,
            statPoints: allocate(save.statPoints, opts.build, save.statPoints.unspent),
          };
        }
        if (result.over) break;
      }
    }

    spentOnPotions += today.potion;
    spentOnInn += today.inn;

    const gainedExp =
      save.player.level > before.level
        ? save.player.exp + expBetween(before.level, save.player.level) - before.exp
        : save.player.exp - before.exp;

    log.push({
      day,
      level: save.player.level,
      gold: today.gold,
      goldLost: today.lost,
      potionCost: today.potion,
      innCost: today.inn,
      exp: gainedExp,
      kills: today.kills,
      entries: today.entries,
      deaths: today.deaths,
      clearRate: today.entries > 0 ? today.cleared / today.entries : 0,
    });
  }

  return {
    save,
    log,
    spentOnGates,
    spentOnPotions,
    spentOnInn,
    spentOnGear,
    days: log.length,
  };
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
