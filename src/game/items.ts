/**
 * 장비 개체 (§4.5). 정의(EQUIPMENT)는 콘텐츠고, 여기서 다루는 건 **개체**다.
 *
 * 같은 "강철 대검"이라도 품질과 강화가 달라서 스탯이 다르다. 그래서 세이브에는
 * 정의 ID가 아니라 { uid, defId, quality, enhance }가 들어간다.
 * React를 import하지 않는다 — Node에서 돌아야 한다.
 */
import { equipmentById, type Equipment } from '../content';
import type { ItemInstance, Ring, Save } from '../save/schema';
import {
  combatStats,
  ENHANCE_MULT,
  GEAR_SLOTS,
  gearShare,
  itemStat,
  RARITY_MULT,
  RING_FIELD_WP_CAP,
  ringValue,
  rollQuality,
  type GearSlot,
  type RingKind,
} from './formulas';

export type GearBonus = {
  atk: number;
  maxHp: number;
  def: number;
  str: number;
  agi: number;
  luk: number;
};

const NONE: GearBonus = { atk: 0, maxHp: 0, def: 0, str: 0, agi: 0, luk: 0 };

/** 세이브 안에서만 유일하면 된다. 가진 것 중 가장 큰 번호 + 1. 반지 목록에도 쓴다 (T17_7) */
export function nextUid(inventory: { uid: string }[]): string {
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
  // 1차 스탯은 소수 한 자리를 남긴다. 반올림하면 낮은 티어에서 전부 0이 된다
  const primary = (base: number) => round1(itemStat(base, inst.quality, inst.enhance));
  return {
    atk: scaled(def.atk),
    maxHp: scaled(def.maxHp),
    def: scaled(def.def),
    str: primary(def.str),
    agi: primary(def.agi),
    luk: primary(def.luk),
  };
}

/**
 * 정렬용 한 숫자 (T17_1) — **그 개체의 스탯 크기**다.
 *
 * `gearStats`가 `맨몸 × gearShare(레벨) × 등급배율 × 부위몫`으로 뽑으므로(§4.5),
 * 거기서 부위몫만 뺀 게 이 값이다. 부위몫은 애초에 부위끼리 비교가 안 되는 부분이라
 * (무기의 ATK 0.75와 투구의 HP 0.5는 같은 눈금이 아니다) 빼는 게 맞다.
 * **맨몸은 빼면 안 된다** (T17_7 검수 5차) — 맨몸이 레벨 따라 두 배쯤 자라서, 빼면 티어 5 영웅 +5 검(ATK 68)이
 * 티어 10 일반 검(ATK 95)보다 세게 나와 성능순 정렬과 시뮬의 갈아입기가 둘 다 틀렸다.
 * 맨몸은 네 스탯 모두 "포인트 단위"로 같은 크기라 ATK로 잰다(BASE_STATS).
 *
 * **값(price)으로는 못 잰다** — 전설은 값이 30배인데 스탯은 1.9배라, 값으로 줄 세우면
 * 티어 2 전설이 티어 8 일반보다 위로 온다.
 */
export function itemPower(inst: ItemInstance): number {
  const def = itemDef(inst);
  return (
    combatStats(def.level).atk *
    gearShare(def.level) *
    RARITY_MULT[def.rarity] *
    inst.quality *
    ENHANCE_MULT ** inst.enhance
  );
}

/**
 * "ATK +12 HP +40 AGI +1.2" — 0인 항목은 뺀다. 정의(상점)든 개체(가방)든 같은 모양을 받는다.
 * **한 곳에서만 만든다** — 화면마다 따로 적었더니 SPD·LUK을 빠뜨린 곳이 두 번 나왔고
 * (T17 가방, T17_3 상점), 장신구가 "ATK +0 HP +0 DEF +0"으로 보였다.
 */
export function statText(s: GearBonus): string {
  return (
    [
      s.atk > 0 ? `ATK +${s.atk}` : '',
      s.maxHp > 0 ? `HP +${s.maxHp}` : '',
      s.def > 0 ? `DEF +${s.def}` : '',
      s.str > 0 ? `STR +${s.str}` : '',
      s.agi > 0 ? `AGI +${s.agi}` : '',
      s.luk > 0 ? `LUK +${s.luk}` : '',
    ]
      .filter(Boolean)
      .join(' ') || '스탯 없음'
  );
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
      str: round1(sum.str + s.str),
      agi: round1(sum.agi + s.agi),
      luk: round1(sum.luk + s.luk),
    };
  }, NONE);
}

/** 반지 하나의 효과 값 (T17_7) — ★ · 등급 · 강화를 다 반영한다 */
export function ringEffect(ring: Ring): number {
  return ringValue(ring.kind, ring.tier, ring.rarity, ring.enhance);
}

/** 낀 반지들 (T17_7). 빈 칸과 세이브가 깨져 uid가 떠 있는 칸은 건너뛴다 */
export function equippedRings(save: Save): Ring[] {
  return save.ringSlots
    .map((uid) => save.rings.find((r) => r.uid === uid))
    .filter((r): r is Ring => r !== undefined);
}

/**
 * 낀 반지들이 주는 그 효과의 합 (T17_7). 같은 반지 두 개면 더한다.
 * 입장 WP 할인만 상한이 있다 — 끝까지 올린 두 개를 껴도 절반까지다.
 */
export function ringBonus(save: Save, kind: RingKind): number {
  const sum = equippedRings(save)
    .filter((r) => r.kind === kind)
    .reduce((total, r) => total + ringEffect(r), 0);
  return kind === 'fieldWp' ? Math.min(sum, RING_FIELD_WP_CAP) : sum;
}

/**
 * 가방에 실제로 들어 있는 것 = **안 낀 것** (§4.5, T17_2).
 * 낀 장비까지 세면 같은 물건이 장비 칸과 가방에 두 번 보여서 어느 쪽을 눌러야 할지 헷갈린다.
 */
export function bagItems(save: Save): ItemInstance[] {
  const worn = new Set(GEAR_SLOTS.map((slot) => save.equipped[slot]));
  return save.inventory.filter((i) => !worn.has(i.uid));
}

/** 가방이 꽉 찼나. 드랍·구매·해제가 이걸 본다. */
export function bagFull(save: Save): boolean {
  return bagItems(save).length >= save.bag.capacity;
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
      str: round1(sum.str + e.str),
      agi: round1(sum.agi + e.agi),
      luk: round1(sum.luk + e.luk),
    }),
    NONE,
  );
}

/** 소수 한 자리. 0.1을 여러 번 더하면 부동소수점 찌꺼기가 붙는다. */
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
