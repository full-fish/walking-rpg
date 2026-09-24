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
  fieldLevel,
  gearSetFor,
  regionById,
  type Field,
  type Monster,
  type Region,
} from '../src/content';
import {
  hpAfterLastHitBy,
  makeRng,
  simulateBattle,
  type Combatant,
  type Outcome,
} from '../src/game/battle';
import {
  buyConsumable,
  enhanceItem,
  enhancePick,
  regionMaterials,
  sellItem,
  stayInn,
} from '../src/game/economy';
import { currentMonster, drinkPotion, enterField, settleRun } from '../src/game/field';
import {
  BOSS_BUFF,
  ENHANCE_MAX,
  EXPECTED_GEAR,
  enhanceCost,
  enhanceRate,
  expToNext,
  GEAR_SLOTS,
  MIDNIGHT_WP,
  POTION_CARRY_MAX,
  REGION_COUNT,
  SPENDABLE_STATS,
  WP_COST,
  type SpendableStat,
} from '../src/game/formulas';
import { bagItems, equippedItems, itemDef, itemPower, makeItem } from '../src/game/items';
import { addItem, applyRegen, equipItem, newGame, statsOf } from '../src/game/progression';
import { bossCost, bossState, enterBoss, travel, unlockCost, unlockNext } from '../src/game/region';
import { defaultSave, type ItemInstance, type Save } from '../src/save/schema';

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

/**
 * 어디서 사냥할까. 보통은 **갈 수 있는 곳 중 제일 센 곳**이다 — 보상이 제일 크니까.
 *
 * `cautious`면 제일 쉬운 곳으로 내려간다. 회복할 돈이 없을 때 쓰는 길이다 —
 * 안 넣으면 "돈이 없어 못 고치고, 못 고쳐서 못 버는" 악순환에 갇힌다
 * (힘 몰빵이 시드 하나에서 Lv48에 400일을 갇혔다). 실제 플레이어는 내려간다.
 */
function pickField(region: Region, level: number, cautious = false): Field {
  const sorted = [...region.fields].sort((a, b) => fieldLevel(a) - fieldLevel(b));
  if (cautious) return sorted[0];
  const unlocked = sorted.filter((f) => fieldLevel(f) <= level);
  return unlocked.at(-1) ?? sorted[0];
}

/** 가게에 막 나온 새 물건의 세기 — 품질 100%, +0으로 친다. 낀 것과 견줄 때 쓴다 */
function freshPower(defId: string): number {
  return itemPower({ uid: '', defId, quality: 1, enhance: 0 });
}

/** 낀 것의 세기. 빈 칸이면 0 */
function wornPower(save: Save, slot: (typeof GEAR_SLOTS)[number]): number {
  const uid = save.equipped[slot];
  const item = uid ? save.inventory.find((i) => i.uid === uid) : undefined;
  return item ? itemPower(item) : 0;
}

/**
 * 살 수 있는 가장 좋은 common으로 갈아입는다 (§4.5).
 *
 * **티어가 아니라 세기로 견준다** (T17_6). 강화해 둔 옛 장비나 드랍으로 주운 rare가
 * 새 티어 common보다 세면 안 산다 — 사람은 +5 검을 버리고 +0 검을 사지 않는다.
 * 돈이 모자라면 중요한 부위부터 한 점씩 산다.
 */
export function buyGear(save: Save, rng: () => number): Save {
  const set = gearSetFor(save.player.level, save.regionProgress.current);

  // **사는 순서가 의미를 갖는다** (T16_1). 부위마다 성격이 갈린 뒤로 무기는 ATK만 주므로,
  // 무기부터 사면 더 세게 때리면서 더 빨리 죽는다. 버티는 부위를 먼저 산다.
  let next = save;
  for (const def of wantedGear(save, set)) {
    // 못 산 부위는 다음 날 다시 본다. 하루 돈이 모자랐다고 다음 티어까지 그 칸을 비워두면
    // 실제 플레이와 다르다 — 사람은 이틀에 걸쳐 갖춰 입는다
    if (next.player.gold < def.price) continue;
    const worn = next.equipped[def.slot];
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

/** 지금 낀 것보다 센 새 물건들 — 사는 순서대로 (T16_1). 강화 예산에서 이만큼은 남긴다 */
function wantedGear(save: Save, set = gearSetFor(save.player.level, save.regionProgress.current)) {
  // **사는 순서가 의미를 갖는다** (T16_1). 부위마다 성격이 갈린 뒤로 무기는 ATK만 주므로,
  // 무기부터 사면 더 세게 때리면서 더 빨리 죽는다. 버티는 부위를 먼저 산다.
  const order = ['armor', 'helm', 'pants', 'boots', 'weapon', 'gloves', 'accessory'];
  return [...set]
    .filter((def) => freshPower(def.id) > wornPower(save, def.slot))
    .sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
}

/**
 * 가방 정리 (T17_6) — 부위마다 **제일 센 것을 끼고** 나머지는 판다.
 * 드랍을 줍게 된 뒤로 사람이 하는 일 그대로다. 파는 값을 돌려준다 (드랍 판매 수입).
 */
function sortGear(save: Save, wear: boolean): { save: Save; sold: number } {
  let next = save;
  for (const slot of wear ? GEAR_SLOTS : []) {
    const fits = next.inventory.filter(
      (i) => itemDef(i).slot === slot && itemDef(i).level <= next.player.level,
    );
    const best = fits.reduce<ItemInstance | undefined>(
      (a, b) => (a && itemPower(a) >= itemPower(b) ? a : b),
      undefined,
    );
    if (best && next.equipped[slot] !== best.uid) next = equipItem(next, best.uid) ?? next;
  }
  const before = next.player.gold;
  for (const item of bagItems(next)) next = sellItem(next, item.uid) ?? next;
  return { save: next, sold: next.player.gold - before };
}

/**
 * 남는 골드로 낀 장비를 강화한다 (T17_6). **한 단계의 기대값(비용 ÷ 성공률)이 제일 싼 것부터.**
 * `reserve`만큼은 남긴다 — 물약·여관·아직 못 산 장비가 먼저다.
 * 강화를 안 넣으면 남은 골드가 수입의 절반을 넘어 시뮬이 실제보다 약하게 나온다.
 */
function enhanceGear(save: Save, reserve: number, rng: () => number) {
  let next = save;
  let spent = 0;
  let materials = 0;
  for (;;) {
    // +6부터는 소재가 있어야 한다 (T17_6 검수) — 없는 장비는 이번엔 건너뛴다
    const steps = equippedItems(next)
      .filter((i) => i.enhance < ENHANCE_MAX && enhancePick(next, i) !== null)
      .map((i) => ({
        uid: i.uid,
        cost: enhanceCost(itemDef(i).price, i.enhance + 1),
        step: i.enhance + 1,
      }));
    const cheapest = steps.reduce<(typeof steps)[number] | undefined>(
      (a, b) => (a && a.cost / enhanceRate(a.step) <= b.cost / enhanceRate(b.step) ? a : b),
      undefined,
    );
    if (!cheapest || next.player.gold - cheapest.cost < reserve) break;
    const tried = enhanceItem(next, cheapest.uid, rng);
    if (!tried) break;
    next = tried.save;
    spent += tried.cost;
    materials += tried.materials;
  }
  return { save: next, spent, materials };
}

/**
 * 그 지역 **보통으로 투자한 사람**의 한 벌 (EXPECTED_GEAR, T17_6 검수) — 그 레벨에 그 지역에서
 * 살 수 있는 가장 높은 티어, 품질 100%. 보스 배율과 벤치가 이걸 기준으로 잰다.
 */
export function expectedSet(level: number, region: number): ItemInstance[] {
  const { rarity, enhance } = EXPECTED_GEAR[region - 1];
  return gearSetFor(level, region, rarity).map((def, i) => ({
    uid: String(i + 1),
    defId: def.id,
    quality: 1,
    enhance,
  }));
}

/**
 * 보스 벤치용 기준 세이브 (T17_5) — 그 레벨, 균등 배분(STR·VIT·AGI), 그 지역 **보통으로 투자한**
 * 한 벌(expectedSet), 그 지역 물약 3개. 보스 배율은 **이 상태로 승률 50%** 가 되게 잡는다 (T17_6 검수).
 */
export function baselineSave(level: number, region: number): Save {
  const ups = level - 1;
  let save: Save = {
    ...defaultSave(),
    player: { level, exp: 0, gold: 0, hp: 1 },
    statPoints: { unspent: 0, str: ups, vit: ups, agi: ups, luk: 0, int: 0 },
    wp: { current: 1_000_000, grantedByDate: {}, lastMidnightGrantAt: '' },
    consumables: { [bestPotion(region).id]: POTION_CARRY_MAX },
    regionProgress: { current: region, unlocked: region, bosses: {} },
  };
  for (const item of expectedSet(level, region)) save = equipItem(addItem(save, item), item.uid)!;
  return { ...save, player: { ...save.player, hp: statsOf(save).maxHp } };
}

/**
 * 보스 한 판 (T17_5) — 기준 세이브로 들어가 fight()로 싸운다. 화면과 같은 규칙이다.
 * `boss`를 주면 그 몬스터와 싸운다 — 배율을 바꿔 가며 승률을 재는 벤치가 쓴다.
 */
export function bossTrial(level: number, region: number, rng: () => number, boss?: Monster) {
  const inside = enterBoss(baselineSave(level, region))!;
  return fight(inside, rng, boss).outcome;
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

/** 보스 앞 — 조금이라도 다쳤으면 묵는다 (T17_5). */
function restFull(save: Save, region: Region, now: number): { save: Save; spent: number } {
  if (save.player.hp >= statsOf(save).maxHp) return { save, spent: 0 };
  const rested = stayInn(save, region.town.inn, now);
  return rested ? { save: rested, spent: region.town.inn } : { save, spent: 0 };
}

/** 다쳤으면 여관에 묵는다 (§4.5). 자연회복만으로는 하루 6~9판을 못 버틴다. */
function rest(save: Save, region: Region, now: number): { save: Save; spent: number } {
  const maxHp = statsOf(save).maxHp;
  if (save.player.hp >= maxHp * INN_THRESHOLD) return { save, spent: 0 };

  const rested = stayInn(save, region.town.inn, now);
  return rested ? { save: rested, spent: region.town.inn } : { save, spent: 0 };
}

/**
 * 한 마리와 싸운다. HP가 POTION_THRESHOLD 아래로 떨어지면 **전투 중에도** 마신다 (T17_3).
 *
 * 전투 화면과 같은 방법이다 — 미리 계산한 전투를 그 지점에서 끊고, 마시고, 남은 싸움을
 * 새 HP로 다시 뽑는다(app/battle.tsx의 onDrink). 한 방에 0이 되면 마실 틈이 없다.
 * 물약은 매번 하나씩 줄어드니 많아야 세 번 돈다.
 */
export function fight(
  save: Save,
  rng: () => number,
  monster: Monster = currentMonster(save)!,
): { save: Save; outcome: Outcome; playerHp: number } {
  let monsterHp = monster.maxHp;
  for (;;) {
    const stats = statsOf(save);
    const player: Combatant = { name: '', hp: save.player.hp, ...stats };
    const battle = simulateBattle(player, { ...monster, hp: monsterHp }, rng);

    const potion = Object.keys(save.run!.potions)[0];
    const cut = potion
      ? battle.events.findIndex(
          (e) =>
            e.actor === 'monster' && e.hpAfter > 0 && e.hpAfter < stats.maxHp * POTION_THRESHOLD,
        )
      : -1;
    const drunk = cut < 0 ? null : drinkPotion(save, potion, battle.events[cut].hpAfter);
    if (!drunk) return { save, outcome: battle.outcome, playerHp: battle.playerHp };

    monsterHp = hpAfterLastHitBy(battle.events.slice(0, cut + 1), 'player', monsterHp);
    save = drunk;
  }
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

export type SimOptions = {
  steps: number;
  build: Build;
  maxLevel: number;
  maxDays: number;
  /**
   * 주운 장비를 끼고 남는 골드를 강화에 쏟나 (T17_6). 기본은 그렇다 — 실제 플레이에 가깝다.
   * 끄면 **기준선 플레이어**다 — common만 사서 끼고, 주운 건 전부 팔고, 강화는 안 한다.
   * 몬스터는 이제 "보통으로 투자한 사람"(EXPECTED_GEAR)에 맞춰져 있어서(T17_6 검수) 기준선은
   * 보스에서 막히고 한참 느리다 — 강화를 안 하면 어떻게 되는지 보는 쪽이다.
   */
  invest?: boolean;
};

/**
 * 지역 관문에서 지금 할 일 (T17_5). 지역 끝 레벨에 닿으면 보스 → 해금 → 이동 순서다.
 * 마지막 지역은 다음이 없어서 관문이 없다.
 *
 * **보스에 지면 한 레벨 더 올리고 다시 간다** (`lostAt`). 1:1 전투는 길어서 운이 거의 평균으로
 * 수렴한다 — 기준선에서 스탯이 1할만 모자라도 승률이 50% → 0%로 떨어진다(벤치 참고).
 * 같은 레벨로 매일 들이받으면 영영 못 넘는다. 사람은 지면 사냥터로 돌아가 키워 온다.
 */
function gateStep(
  save: Save,
  lostAt: number,
): { step: 'boss' | 'unlock' | 'travel'; cost: number } | null {
  const here = regionById(save.regionProgress.current);
  if (here.id >= REGION_COUNT || save.player.level < here.levelRange[1]) return null;
  if (bossState(save, here.id) !== 'cleared') {
    return save.player.level > lostAt ? { step: 'boss', cost: bossCost(save, here.id) } : null;
  }
  if (save.regionProgress.unlocked === here.id) return { step: 'unlock', cost: unlockCost(save) };
  return { step: 'travel', cost: WP_COST.regionTravel };
}

/**
 * 하루치를 돌린다. 걸음이 WP가 되고, WP가 사냥터 입장이 되고, 입장이 보상이 된다 (§4.1, §6.1).
 * 남은 WP는 다음 날로 넘어간다 — 상한이 없다 (§4.1).
 *
 * 지역 관문(T17_5)에 닿으면 **WP를 관문에 먼저 쓴다.** 모자라면 그날은 사냥을 접고 모은다 —
 * 사냥에 다 써버리면 관문 앞에서 영영 못 넘는다. §4.1의 "관문 몫 약 10일치"가 여기서 나온다.
 */
export function simulate(opts: SimOptions, seed = 1) {
  const rng = makeRng(seed);
  let save: Save = newGame();
  let spentOnGates = 0;
  let spentOnPotions = 0;
  let spentOnInn = 0;
  let spentOnGear = 0;
  let spentOnEnhance = 0;
  let soldGear = 0;
  /** 소재를 어디에 썼나 (T17_6 검수) — 모은 양은 남은 것 + 이 둘이다 */
  const materialsUsed = { enhance: 0, boss: 0 };
  const bosses: { region: number; day: number; level: number; tries: number }[] = [];
  let tries = 0;
  /** 보스에 마지막으로 진 레벨. 그보다 올라야 다시 도전한다 */
  let lostAt = 0;
  const log: DayLog[] = [];

  for (let day = 1; day <= opts.maxDays && save.player.level < opts.maxLevel; day++) {
    save = { ...save, wp: { ...save.wp, current: save.wp.current + opts.steps + MIDNIGHT_WP } };

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
      const here = regionById(save.regionProgress.current);

      // 하루 안에서도 시간이 흐른다 — 입장 사이에 자연회복이 조금씩 붙는다 (§4.2).
      // 하루 7판이면 판 사이가 3시간쯤이고 최대 HP의 20%가 찬다. 나머지는 돈으로 메운다.
      const now = dayStart + Math.round((today.entries * 86_400_000) / 9);
      save = applyRegen(save, now);

      // 마을에서 할 일 — 주운 것 정리, 장비 갈아입기, 물약 채우기, 너무 다쳤으면 여관
      const sorted = sortGear(save, opts.invest !== false);
      save = sorted.save;
      soldGear += sorted.sold;
      const goldBefore = save.player.gold;
      save = buyGear(save, rng);
      spentOnGear += goldBefore - save.player.gold;

      const stocked = restock(save, here.id);
      save = stocked.save;
      today.potion += stocked.spent;

      const gate = gateStep(save, lostAt);
      // 보스 앞에서는 만피로 들어간다. 반쯤 다친 채로 관문 값을 내는 사람은 없다
      const rested = gate?.step === 'boss' ? restFull(save, here, now) : rest(save, here, now);
      save = rested.save;
      today.inn += rested.spent;

      // 남는 골드는 강화로 (T17_6). 물약 한 번 채울 값 · 여관 한 번 · 아직 못 산 장비는 남긴다
      const reserve =
        here.town.inn +
        bestPotion(here.id).price * POTION_CARRY_MAX +
        wantedGear(save).reduce((sum, def) => sum + def.price, 0);
      if (opts.invest !== false) {
        const enhanced = enhanceGear(save, reserve, rng);
        save = enhanced.save;
        spentOnEnhance += enhanced.spent;
        materialsUsed.enhance += enhanced.materials;
      }

      if (gate) {
        if (save.wp.current < gate.cost) break;
        spentOnGates += gate.cost;
        if (gate.step === 'unlock') {
          save = unlockNext(save)!;
          continue;
        }
        if (gate.step === 'travel') {
          save = travel(save, here.id + 1)!;
          continue;
        }
        // 보스 — 다쳤는데 회복할 돈도 없으면 오늘은 접는다
        if (save.player.hp < statsOf(save).maxHp) break;
        // 남은 그 지역 소재는 보스 버프로 쓴다 (T17_6 검수). 강화에 먼저 쓰고 남은 만큼이다
        const buffs = Math.min(BOSS_BUFF.max, regionMaterials(save, here.id));
        const inside = enterBoss(save, buffs, rng);
        if (!inside) break;
        materialsUsed.boss += buffs;
        tries += 1;
        const battle = fight(inside, rng);
        const result = settleRun(battle.save, battle.outcome, battle.playerHp, rng, now);
        save = result.save;
        today.gold += result.gained.gold;
        today.lost += result.goldLost;
        if (battle.outcome === 'lose') today.deaths += 1;
        if (result.bossCleared) {
          bosses.push({ region: here.id, day, level: save.player.level, tries });
          tries = 0;
          lostAt = 0;
        } else {
          lostAt = save.player.level;
        }
        if (save.statPoints.unspent > 0) {
          save = {
            ...save,
            statPoints: allocate(save.statPoints, opts.build, save.statPoints.unspent),
          };
        }
        continue;
      }

      if (save.wp.current < WP_COST.fieldEntry(here.id)) break;

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

        const battle = fight(save, rng);
        save = battle.save;
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
    spentOnEnhance,
    soldGear,
    materialsUsed,
    bosses,
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
