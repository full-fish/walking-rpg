/**
 * 경제 (§4.5, §3.7) — 상점·여관·창고·강화·반지.
 *
 * 전부 **실패하면 null**을 돌려준다. spendPoint·equipItem과 같은 규약이라
 * 호출부가 "살 수 있나"를 따로 묻지 않고 결과만 확인하면 된다.
 * React를 import하지 않는다 — Node에서 돌아야 한다.
 */
import { arrowById, consumableById, equipmentById, gridItem, regionById } from '../content';
import type { ItemInstance, Ring, Save } from '../save/schema';
import {
  ARROW,
  ENHANCE_MAX,
  enhanceCost,
  enhanceMaterials,
  enhanceRate,
  BAG,
  bagExpandCost,
  GEAR_TIERS_PER_REGION,
  RARITIES,
  REGION_COUNT,
  RING_COST,
  RING_KINDS,
  SELL_RATE,
  SHOP_RARITIES,
  VAULT,
  vaultExpandCost,
  type GridRarity,
} from './formulas';
import { bossBonus } from './dex';
import { bagFull, itemDef, makeItem, nextUid, ringBonus } from './items';
import { addItem, statsOf, withStatChange } from './progression';

/** 골드를 더하고 뺀다. 음수 잔고는 여기서 막는다. */
function withGold(save: Save, delta: number): Save | null {
  const gold = save.player.gold + delta;
  if (gold < 0) return null;
  return { ...save, player: { ...save.player, gold } };
}

function count(map: Record<string, number>, id: string): number {
  return map[id] ?? 0;
}

function bump(map: Record<string, number>, id: string, delta: number): Record<string, number> {
  const next = { ...map, [id]: count(map, id) + delta };
  if (next[id] <= 0) delete next[id];
  return next;
}

/** 그 지역 사냥터 소재를 몇 개 가졌나 (T17_6 검수). */
export function regionMaterials(save: Save, region: number): number {
  return regionById(region).fields.reduce((sum, f) => sum + count(save.materials, f.id), 0);
}

/**
 * 그 지역 사냥터 소재를 n개 고른다 (T17_6 검수) — **가진 게 많은 곳부터** 하나씩 집어서,
 * 나중에 +7~+10이 요구하는 "서로 다른 사냥터"가 되도록 남겨 둔다. `distinct`면 한 곳에서 하나만.
 * 모자라면 null. 고르기만 하고 빼지는 않는다 — 쓰는 쪽이 spendMaterials로 뺀다.
 */
export function pickMaterials(
  save: Save,
  region: number,
  n: number,
  distinct: boolean,
): string[] | null {
  const left = { ...save.materials };
  const ids = regionById(region).fields.map((f) => f.id);
  const picked: string[] = [];
  for (let i = 0; i < n; i++) {
    const pool = ids.filter((id) => count(left, id) > 0 && !(distinct && picked.includes(id)));
    if (pool.length === 0) return null;
    const best = pool.reduce((a, b) => (count(left, b) > count(left, a) ? b : a));
    picked.push(best);
    left[best] -= 1;
  }
  return picked;
}

/**
 * 소재를 **고른 대로** 쓸 수 있는지 본다 (T17_7 검수 4차) — 그 지역 사냥터 것 정확히 n개, 가진 만큼,
 * `distinct`면 한 곳에서 하나씩. 맞으면 고른 그대로, 틀리면 null. 안 고르면 pickMaterials가 대신 고른다 —
 * 시뮬과 [자동] 버튼이 그쪽을 쓴다.
 */
export function chooseMaterials(
  save: Save,
  region: number,
  n: number,
  distinct: boolean,
  chosen?: readonly string[],
): string[] | null {
  if (!chosen) return pickMaterials(save, region, n, distinct);
  const ids = new Set(regionById(region).fields.map((f) => f.id));
  if (chosen.length !== n || chosen.some((id) => !ids.has(id))) return null;
  if (distinct && new Set(chosen).size !== n) return null;
  const want = chosen.reduce<Record<string, number>>((m, id) => bump(m, id, 1), {});
  const enough = Object.entries(want).every(([id, k]) => count(save.materials, id) >= k);
  return enough ? [...chosen] : null;
}

export function spendMaterials(save: Save, ids: string[]): Save {
  return { ...save, materials: ids.reduce((m, id) => bump(m, id, -1), save.materials) };
}

// ─────────────────────────────────────────────────────────────
// 상점 — 장비
// ─────────────────────────────────────────────────────────────

/**
 * 장비를 산다 (§4.5). 품질은 살 때 굴린다 — 드랍과 같은 함수를 지나야 개체차가 생긴다.
 * 가방이 차면 안 판다. 사놓고 사라지는 것보다 못 사는 게 낫다.
 */
export function buyEquipment(save: Save, defId: string, rng: () => number): Save | null {
  const def = equipmentById(defId);
  // 전설은 드랍으로만 나온다 (T17_6)
  if (!(SHOP_RARITIES as readonly string[]).includes(def.rarity)) return null;
  if (bagFull(save)) return null;

  const paid = withGold(save, -def.price);
  if (!paid) return null;
  return addItem(paid, makeItem(paid.inventory, defId, rng));
}

/** 되팔 때 받는 골드 (§4.5). 정가 × 품질 × SELL_RATE(0.1) — 강화분은 안 쳐준다. */
export function sellPrice(item: ItemInstance): number {
  return Math.max(1, Math.round(itemDef(item).price * item.quality * SELL_RATE));
}

/** 판다. **낀 것은 못 판다** — 실수로 알몸이 되는 경로를 아예 없앤다. */
export function sellItem(save: Save, uid: string): Save | null {
  const item = save.inventory.find((i) => i.uid === uid);
  if (!item) return null;
  if (Object.values(save.equipped).includes(uid)) return null;

  return {
    ...save,
    player: { ...save.player, gold: save.player.gold + sellPrice(item) },
    inventory: save.inventory.filter((i) => i.uid !== uid),
  };
}

// ─────────────────────────────────────────────────────────────
// 상점 — 물약
// ─────────────────────────────────────────────────────────────

export function buyConsumable(save: Save, id: string, amount = 1): Save | null {
  const def = consumableById(id);
  const paid = withGold(save, -def.price * amount);
  if (!paid) return null;
  return { ...paid, consumables: bump(paid.consumables, id, amount) };
}

/**
 * 화살 한 묶음(ARROW.bundle발)을 산다 (T18). 가방 칸을 안 쓴다. **기본 화살만 판다** — 특수는 몬스터가 떨군다(T18_1).
 * 아직 먹인 화살이 없으면 이걸 먹인다 — 사 놓고 안 골라서 활로 치는 일이 없게.
 */
export function buyArrows(save: Save, id: string): Save | null {
  const def = arrowById(id);
  if (def.effect !== 'basic') return null;
  const paid = withGold(save, -def.price);
  if (!paid) return null;
  const owned = save.quiver !== null && count(save.arrows, save.quiver) > 0;
  return {
    ...paid,
    arrows: bump(paid.arrows, id, ARROW.bundle),
    quiver: owned ? save.quiver : id,
  };
}

/** 활에 먹일 화살을 고른다 (T18). 가진 것만 */
export function setQuiver(save: Save, id: string): Save | null {
  if (count(save.arrows, id) <= 0) return null;
  return { ...save, quiver: id };
}

/**
 * 물약 한 병의 회복량 (§4.5). 절대값(heal) 또는 최대 HP 비율(엘릭서)에 물약 반지(T17_7)를 곱한다.
 * 마을·사냥터·전투 화면이 전부 이걸 본다 — 따로 세면 화면의 "+N"과 실제가 어긋난다.
 */
export function potionHeal(save: Save, id: string): number {
  const def = consumableById(id);
  const raw = def.heal + statsOf(save).maxHp * def.healRatio;
  return Math.round(raw * (1 + ringBonus(save, 'potion')));
}

/**
 * 물약을 쓴다 (§4.5). 절대값 회복(heal) 또는 최대 HP 비율(엘릭서).
 * 이름이 useConsumable이 아닌 건 lint가 React 훅으로 오해하기 때문이다.
 * 이미 만피면 안 쓴다 — 누르자마자 한 병이 증발하는 게 제일 억울하다.
 */
export function consumeItem(save: Save, id: string): Save | null {
  if (count(save.consumables, id) <= 0) return null;

  const maxHp = statsOf(save).maxHp;
  if (save.player.hp >= maxHp) return null;

  const healed = potionHeal(save, id);
  return {
    ...save,
    player: { ...save.player, hp: Math.min(maxHp, save.player.hp + healed) },
    consumables: bump(save.consumables, id, -1),
  };
}

// ─────────────────────────────────────────────────────────────
// 여관 (§4.5)
// ─────────────────────────────────────────────────────────────

/** 골드를 내고 HP를 전부 채운다. 만피면 안 받는다. now는 자연회복 기준 시각 (§4.2). */
export function stayInn(save: Save, cost: number, now: number): Save | null {
  const maxHp = statsOf(save).maxHp;
  if (save.player.hp >= maxHp) return null;

  const paid = withGold(save, -cost);
  if (!paid) return null;
  return { ...paid, player: { ...paid.player, hp: maxHp }, hpUpdatedAt: now };
}

// ─────────────────────────────────────────────────────────────
// 창고 (§3.7)
// ─────────────────────────────────────────────────────────────

/** 실제로 창고에 들어가는 액수 = 낸 것의 98% (수수료 2%). */
export function depositNet(amount: number): number {
  return Math.floor(amount * (1 - VAULT.fee));
}

/**
 * 입금 (§3.7). 수수료를 뗀 **나머지**가 한도를 넘으면 거절한다 —
 * 한도까지만 넣고 나머지를 돌려주면 수수료 계산이 두 벌이 된다.
 */
export function vaultDeposit(save: Save, amount: number): Save | null {
  if (amount <= 0) return null;
  const net = depositNet(amount);
  if (net <= 0) return null;
  if (save.vault.gold + net > save.vault.capacity) return null;

  const paid = withGold(save, -amount);
  if (!paid) return null;
  return { ...paid, vault: { ...paid.vault, gold: paid.vault.gold + net } };
}

/** 출금은 무료다 (§3.7). */
export function vaultWithdraw(save: Save, amount: number): Save | null {
  if (amount <= 0 || amount > save.vault.gold) return null;
  return {
    ...save,
    player: { ...save.player, gold: save.player.gold + amount },
    vault: { ...save.vault, gold: save.vault.gold - amount },
  };
}

/** 한도를 2배로. 비용은 **현재** 한도 × 0.6이고 8회가 상한이다 (§3.7). */
export function vaultExpand(save: Save): Save | null {
  if (save.vault.expansions >= VAULT.maxExpansions) return null;

  const paid = withGold(save, -vaultExpandCost(save.vault.capacity));
  if (!paid) return null;
  return {
    ...paid,
    vault: {
      ...paid.vault,
      capacity: paid.vault.capacity * VAULT.step,
      expansions: paid.vault.expansions + 1,
    },
  };
}

/** 가방을 BAG.step칸 늘린다 (§4.5, T17_2). 값은 확장 횟수를 따라 1.6배씩 오른다. */
export function bagExpand(save: Save): Save | null {
  if (save.bag.expansions >= BAG.maxExpansions) return null;

  const paid = withGold(save, -bagExpandCost(save.bag.expansions));
  if (!paid) return null;
  return {
    ...paid,
    bag: { capacity: paid.bag.capacity + BAG.step, expansions: paid.bag.expansions + 1 },
  };
}

// ─────────────────────────────────────────────────────────────
// 강화 (§4.5) — T15
// ─────────────────────────────────────────────────────────────

export type EnhanceResult = {
  save: Save;
  success: boolean;
  /** 성공하든 실패하든 나간 골드 */
  cost: number;
  /** 시도한 단계 (+N의 N) */
  step: number;
  /** 쓴 소재 수 (+6부터, 성공했을 때만) */
  materials: number;
};

/** 다음 단계 강화에 쓸 소재 — 그 장비 지역의 서로 다른 사냥터에서 하나씩. 모자라면 null */
export function enhancePick(save: Save, item: ItemInstance): string[] | null {
  return pickMaterials(save, itemDef(item).region, enhanceMaterials(item.enhance + 1), true);
}

/** 이 세이브의 강화 성공률 — 표에 보스 도감 5번(T19 검수 2차)의 %p를 더한다. 100%를 넘지 않는다 */
export function enhanceChance(save: Save, next: number): number {
  const rate = enhanceRate(next);
  return rate === 0 ? 0 : Math.min(1, rate + bossBonus(save).enhance);
}

/**
 * 강화 한 번의 공통 규칙 (§4.5, T17_7) — 장비와 반지가 같이 쓴다. 규칙이 둘로 갈리면 안 된다.
 * 골드는 두드릴 때 나가고, +6부터 드는 소재는 **성공했을 때만** 뺀다. 성공하면 `bump`로 단계를 올린다.
 * `chosen`은 플레이어가 고른 소재다 (T17_7 검수 4차). 안 주면 가진 게 많은 곳부터 고른다.
 */
function tryEnhance(
  save: Save,
  from: number,
  price: number,
  region: number,
  rng: () => number,
  bump: (paid: Save) => Save,
  chosen?: readonly string[],
): EnhanceResult | null {
  if (from >= ENHANCE_MAX) return null;
  const step = from + 1;
  const picked = chooseMaterials(save, region, enhanceMaterials(step), true, chosen);
  if (!picked) return null;
  const cost = enhanceCost(price, step);
  const paid = withGold(save, -cost);
  if (!paid) return null;

  const success = rng() < enhanceChance(save, step);
  if (!success) return { save: paid, success, cost, step, materials: 0 };
  return {
    save: bump(spendMaterials(paid, picked)),
    success,
    cost,
    step,
    materials: picked.length,
  };
}

/**
 * 장비 한 점을 한 단계 올려 본다 (§4.5).
 *
 * **실패해도 골드만 없어진다** — 단계가 내려가지도, 장비가 깨지지도 않는다.
 * 그래서 +10은 운이 아니라 **돈으로 가는 곳**이고, 기대 골드가 곧 목표 난이도다.
 * 강화는 **인스턴스 단위**다. 같은 이름의 장비 두 개가 서로 다른 단계를 가진다.
 * 난수를 주입받는 건 기대 시도 횟수를 테스트로 재현해야 하기 때문이다.
 */
export function enhanceItem(
  save: Save,
  uid: string,
  rng: () => number,
  chosen?: readonly string[],
): EnhanceResult | null {
  const item = save.inventory.find((i) => i.uid === uid);
  if (!item) return null;
  const def = itemDef(item);
  return tryEnhance(
    save,
    item.enhance,
    def.price,
    def.region,
    rng,
    (paid) =>
      // 낀 장비를 강화하면 최대 HP가 늘어난다. 현재 HP도 같이 올린다 (장착과 같은 규칙)
      withStatChange(paid, {
        ...paid,
        inventory: paid.inventory.map((i) =>
          i.uid === uid ? { ...i, enhance: i.enhance + 1 } : i,
        ),
      }),
    chosen,
  );
}

// ─────────────────────────────────────────────────────────────
// 반지 (T17_7) — 고유 장비 대신. 특수 소재로만 얻고 올린다
// ─────────────────────────────────────────────────────────────

/**
 * 반지의 다음 한 단계 (T17_7) — 등급을 하나 올리고, 전설이면 다음 ★ 일반으로. 끝(★5 전설)이면 null.
 * 소재는 **올라갈 ★의 지역**에서 든다 — 등급은 지금 ★ 지역, ★ 올리기는 다음 지역이다.
 */
export function ringNext(ring: Ring): { tier: number; rarity: GridRarity; cost: number } | null {
  const i = RARITIES.indexOf(ring.rarity);
  if (i < RARITIES.length - 1) {
    return { tier: ring.tier, rarity: RARITIES[i + 1], cost: RING_COST.rarity[i] };
  }
  if (ring.tier < REGION_COUNT)
    return { tier: ring.tier + 1, rarity: 'common', cost: RING_COST.tier };
  return null;
}

/**
 * 새 반지 (T17_7) — **초원(지역 1) 소재를 서로 다른 사냥터에서 3개** 내고 ★1 일반을 받는다.
 * 어느 반지가 나올지는 무작위다 — 같은 반지가 또 나와도 두 칸에 같이 낄 수 있다.
 */
export function exchangeRing(
  save: Save,
  rng: () => number,
  chosen?: readonly string[],
): Save | null {
  const picked = chooseMaterials(save, 1, RING_COST.exchange, true, chosen);
  if (!picked) return null;
  const ring: Ring = {
    uid: nextUid(save.rings),
    kind: RING_KINDS[Math.floor(rng() * RING_KINDS.length)],
    tier: 1,
    rarity: 'common',
    enhance: 0,
  };
  return { ...spendMaterials(save, picked), rings: [...save.rings, ring] };
}

/**
 * 반지를 한 단계 올린다 (T17_7). 소재만 들고 실패는 없다. **강화 단계는 그대로다** (T17_7 검수 4차 —
 * 전에는 +0으로 돌아갔다). 강화한 값은 새 등급 값에 그대로 곱해진다.
 */
export function upgradeRing(save: Save, uid: string, chosen?: readonly string[]): Save | null {
  const ring = save.rings.find((r) => r.uid === uid);
  const next = ring && ringNext(ring);
  if (!next) return null;
  const picked = chooseMaterials(save, next.tier, next.cost, true, chosen);
  if (!picked) return null;
  return {
    ...spendMaterials(save, picked),
    rings: save.rings.map((r) =>
      r.uid === uid ? { ...r, tier: next.tier, rarity: next.rarity } : r,
    ),
  };
}

/**
 * 반지 강화의 기준 값 (T17_7) — 그 ★ 지역 뒷단 장신구의 같은 등급 값. 장비와 같은 골드 곡선을 탄다.
 * 반지는 팔 수 없어서 이 값은 강화 비용에만 쓴다.
 */
export function ringPrice(ring: Ring): number {
  return gridItem(ring.tier * GEAR_TIERS_PER_REGION, 'accessory', ring.rarity).price;
}

/** 반지 강화에 쓸 소재 — +6부터 그 ★ 지역의 서로 다른 사냥터에서 (T17_7). 모자라면 null */
export function ringEnhancePick(save: Save, ring: Ring): string[] | null {
  return pickMaterials(save, ring.tier, enhanceMaterials(ring.enhance + 1), true);
}

/** 반지를 한 단계 강화해 본다 (T17_7) — 장비 강화와 같은 성공률·값·소재 규칙이다 */
export function enhanceRing(
  save: Save,
  uid: string,
  rng: () => number,
  chosen?: readonly string[],
): EnhanceResult | null {
  const ring = save.rings.find((r) => r.uid === uid);
  if (!ring) return null;
  return tryEnhance(
    save,
    ring.enhance,
    ringPrice(ring),
    ring.tier,
    rng,
    (paid) => ({
      ...paid,
      rings: paid.rings.map((r) => (r.uid === uid ? { ...r, enhance: r.enhance + 1 } : r)),
    }),
    chosen,
  );
}
