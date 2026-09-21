/**
 * 경제 (§4.5, §3.7) — 상점·여관·창고·고유 교환.
 *
 * 전부 **실패하면 null**을 돌려준다. spendPoint·equipItem과 같은 규약이라
 * 호출부가 "살 수 있나"를 따로 묻지 않고 결과만 확인하면 된다.
 * React를 import하지 않는다 — Node에서 돌아야 한다.
 */
import { consumableById, equipmentById, fieldById } from '../content';
import type { ItemInstance, Save } from '../save/schema';
import { INVENTORY_MAX, SELL_RATE, VAULT, vaultExpandCost } from './formulas';
import { itemDef, makeItem } from './items';
import { addItem, statsOf } from './progression';

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

// ─────────────────────────────────────────────────────────────
// 상점 — 장비
// ─────────────────────────────────────────────────────────────

/**
 * 장비를 산다 (§4.5). 품질은 살 때 굴린다 — 드랍과 같은 함수를 지나야 개체차가 생긴다.
 * 가방이 차면 안 판다. 사놓고 사라지는 것보다 못 사는 게 낫다.
 */
export function buyEquipment(save: Save, defId: string, rng: () => number): Save | null {
  const def = equipmentById(defId);
  // 고유 장비는 골드로 못 산다. 소재로만 바꾼다 (§4.4)
  if (def.rarity === 'unique') return null;
  if (save.inventory.length >= INVENTORY_MAX) return null;

  const paid = withGold(save, -def.price);
  if (!paid) return null;
  return addItem(paid, makeItem(paid.inventory, defId, rng));
}

/** 되팔 때 받는 골드 (§4.5). 정가 × 품질 × 0.25 — 강화분은 안 쳐준다. */
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
 * 물약을 쓴다 (§4.5). 절대값 회복(heal) 또는 최대 HP 비율(엘릭서).
 * 이름이 useConsumable이 아닌 건 lint가 React 훅으로 오해하기 때문이다.
 * 이미 만피면 안 쓴다 — 누르자마자 한 병이 증발하는 게 제일 억울하다.
 */
export function consumeItem(save: Save, id: string): Save | null {
  if (count(save.consumables, id) <= 0) return null;

  const def = consumableById(id);
  const maxHp = statsOf(save).maxHp;
  if (save.player.hp >= maxHp) return null;

  const healed = def.heal + Math.round(maxHp * def.healRatio);
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

// ─────────────────────────────────────────────────────────────
// 고유 장비 교환 (§4.4, §4.5)
// ─────────────────────────────────────────────────────────────

/**
 * 사냥터 소재 + 골드 → 그 사냥터 전용 장비.
 *
 * 소재는 6마리 완주 시 확정 드랍인데 그건 T16이라, 지금은 설정 탭의 개발용 버튼으로만 들어온다.
 */
export function exchangeUnique(save: Save, fieldId: string, rng: () => number): Save | null {
  const field = fieldById(fieldId);
  const { material, gold } = field.reward.cost;
  if (count(save.materials, fieldId) < material) return null;
  if (save.inventory.length >= INVENTORY_MAX) return null;

  const paid = withGold(save, -gold);
  if (!paid) return null;

  const item = makeItem(paid.inventory, field.reward.id, rng);
  return {
    ...addItem(paid, item),
    materials: bump(paid.materials, fieldId, -material),
  };
}
