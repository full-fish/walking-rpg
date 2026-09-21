/**
 * 장비 개체 (§4.5). 정의(EQUIPMENT)는 콘텐츠고, 여기서 다루는 건 **개체**다.
 *
 * 같은 "강철 대검"이라도 품질과 강화가 달라서 스탯이 다르다. 그래서 세이브에는
 * 정의 ID가 아니라 { uid, defId, quality, enhance }가 들어간다.
 * React를 import하지 않는다 — Node에서 돌아야 한다.
 */
import { equipmentById, type Equipment } from '../content';
import type { ItemInstance, Save } from '../save/schema';
import {
  GEAR_SLOTS,
  itemStat,
  rollQuality,
  UNIQUE_TRAIT_BONUS,
  type GearSlot,
} from './formulas';

export type GearBonus = { atk: number; maxHp: number; def: number; spd: number };

const NONE: GearBonus = { atk: 0, maxHp: 0, def: 0, spd: 0 };

/** 세이브 안에서만 유일하면 된다. 가진 것 중 가장 큰 번호 + 1. */
export function nextUid(inventory: ItemInstance[]): string {
  const max = inventory.reduce((m, i) => Math.max(m, Number(i.uid) || 0), 0);
  return String(max + 1);
}

/**
 * 장비를 하나 만든다 (§4.5). 품질은 이때 굴려서 고정된다 —
 * 드랍이든 구매든 같은 함수를 지나야 "같은 이름인데 다른 물건"이 성립한다.
 */
export function makeItem(
  inventory: ItemInstance[],
  defId: string,
  rng: () => number,
): ItemInstance {
  equipmentById(defId); // 없는 정의면 여기서 죽는다
  return { uid: nextUid(inventory), defId, quality: rollQuality(rng), enhance: 0 };
}

export function itemDef(inst: ItemInstance): Equipment {
  return equipmentById(inst.defId);
}

/** 개체 하나의 최종 스탯 = 정의 × 품질 × 1.1^강화 (§4.5). */
export function itemStats(inst: ItemInstance): GearBonus {
  const def = itemDef(inst);
  const scaled = (base: number) => Math.round(itemStat(base, inst.quality, inst.enhance));
  return {
    atk: scaled(def.atk),
    maxHp: scaled(def.maxHp),
    def: scaled(def.def),
    // SPD만 소수 한 자리를 남긴다. 반올림하면 낮은 티어에서 전부 0이 된다
    spd: Math.round(itemStat(def.spd, inst.quality, inst.enhance) * 10) / 10,
  };
}

/** 인벤토리 표시용 — "강철 대검 (114%)", 강화했으면 "+3" (§4.5). */
export function itemLabel(inst: ItemInstance): string {
  const enhance = inst.enhance > 0 ? ` +${inst.enhance}` : '';
  return `${itemDef(inst).name}${enhance} (${Math.round(inst.quality * 100)}%)`;
}

export function itemByUid(save: Save, uid: string): ItemInstance | undefined {
  return save.inventory.find((i) => i.uid === uid);
}

/** 지금 낀 것들. 빈 칸과 세이브가 깨져 uid가 떠 있는 칸은 건너뛴다. */
export function equippedItems(save: Save): ItemInstance[] {
  return GEAR_SLOTS.map((slot) => save.equipped[slot])
    .filter((uid): uid is string => uid !== null)
    .map((uid) => itemByUid(save, uid))
    .filter((item): item is ItemInstance => item !== undefined);
}

/** 낀 장비가 더해주는 몫 전부 (§4.5). 맨몸 스탯에 더하면 그게 전투 스탯이다. */
export function equippedStats(save: Save): GearBonus {
  return equippedItems(save).reduce((sum, inst) => {
    const s = itemStats(inst);
    return {
      atk: sum.atk + s.atk,
      maxHp: sum.maxHp + s.maxHp,
      def: sum.def + s.def,
      spd: round1(sum.spd + s.spd),
    };
  }, NONE);
}

/**
 * 낀 고유 장비들이 주는 특효 모음 (§4.5). 태그 → 추가 피해 비율.
 * 같은 태그를 여러 부위가 덮어도 **제일 큰 것 하나만** 남긴다 — 곱해서 쌓이면 안 된다.
 */
export function equippedBonusVs(save: Save): Record<string, number> {
  const bonus: Record<string, number> = {};
  for (const inst of equippedItems(save)) {
    for (const trait of itemDef(inst).vs ?? []) {
      bonus[trait] = Math.max(bonus[trait] ?? 0, UNIQUE_TRAIT_BONUS);
    }
  }
  return bonus;
}

/** 그 칸에 낀 것. 없으면 undefined. */
export function equippedIn(save: Save, slot: GearSlot): ItemInstance | undefined {
  const uid = save.equipped[slot];
  return uid === null ? undefined : itemByUid(save, uid);
}

/** 정의 여러 개의 스탯 합 (§4.5). 품질 100%·강화 0 — **밸런스 기준선**이다. */
export function setBonus(defs: Equipment[]): GearBonus {
  return defs.reduce(
    (sum, e) => ({
      atk: sum.atk + e.atk,
      maxHp: sum.maxHp + e.maxHp,
      def: sum.def + e.def,
      spd: round1(sum.spd + e.spd),
    }),
    NONE,
  );
}

/** 소수 한 자리. 0.1을 여러 번 더하면 부동소수점 찌꺼기가 붙는다. */
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
