/**
 * 콘텐츠 로더 (§7.3). 여기를 통해서만 게임 데이터를 읽는다.
 *
 * 앱이 켜지는 순간 검증하고, 틀렸으면 던진다. 잘못된 데이터로 조용히 도는 것보다
 * 즉시 죽는 게 낫다 — 원인이 몬스터 한 마리가 아니라 JSON 한 줄이기 때문이다.
 * 모든 오류를 한 번에 보고 싶으면 `npm run validate`를 쓴다.
 */
import consumablesRaw from './archetypes/consumables.json';
import equipmentArchetypesRaw from './archetypes/equipment.json';
import archetypesRaw from './archetypes/monsters.json';
import regionsRaw from './archetypes/regions.json';
import equipmentRaw from './data/items/equipment.json';
import region01 from './data/monsters/region-01.json';
import region02 from './data/monsters/region-02.json';
import region03 from './data/monsters/region-03.json';
import region04 from './data/monsters/region-04.json';
import region05 from './data/monsters/region-05.json';
import { REGION_COUNT, SHOP_RARITIES, type GearSlot, type GridRarity } from '../game/formulas';
import {
  ConsumablesSchema,
  EquipmentArchetypesSchema,
  EquipmentsSchema,
  MonsterArchetypesSchema,
  MonstersSchema,
  RegionsSchema,
  type Consumable,
  type Equipment,
  type Field,
  type Monster,
  type MonsterArchetype,
  type Region,
} from './schema';

export type { Consumable, Equipment, Field, Monster, MonsterArchetype, Region };

/** 몬스터 원형 15개 (§7.2). */
export const MONSTER_ARCHETYPES = MonsterArchetypesSchema.parse(archetypesRaw);

/** 지역 5개와 사냥터 35개 (§7.2⑤, T17_4). */
export const REGIONS = RegionsSchema.parse(regionsRaw);

/** gen-content.ts가 뽑아둔 몬스터 전부. 보스도 여기 들어 있다. */
export const MONSTERS = MonstersSchema.parse([
  ...region01,
  ...region02,
  ...region03,
  ...region04,
  ...region05,
]);

export function regionById(id: number): Region {
  const region = REGIONS.find((r) => r.id === id);
  if (!region) throw new Error(`없는 지역: ${id}`);
  return region;
}

/**
 * 사냥터에 나올 수 있는 몬스터들 (§4.4).
 * pool의 [원형, 티어]로 찾는다 — id 형식을 여기서 다시 조립하면 gen-content와 어긋난다.
 */
export function monstersOfField(field: Field): Monster[] {
  return field.pool.map(([arch, tier]) => {
    const monster = MONSTERS.find((m) => m.arch === arch && m.tier === tier && !m.boss);
    if (!monster) throw new Error(`${field.id}의 [${arch}, ${tier}] 몬스터가 없다`);
    return monster;
  });
}

/**
 * 그 레벨이 상대할 적정 티어 (§7.2①⑤).
 *
 * 지역이 레벨 구간과 티어 대역을 둘 다 가지고 있으므로 그 안에서 비례로 잡는다.
 * 지역 1은 Lv1~8에 티어 1~5라 레벨 2개에 티어 1개꼴로 오른다 — 티어와 레벨은 같지 않다.
 */
export function tierForLevel(level: number): number {
  const region =
    REGIONS.find((r) => level >= r.levelRange[0] && level <= r.levelRange[1]) ?? REGIONS.at(-1)!;
  const [loLv, hiLv] = region.levelRange;
  const [loTier, hiTier] = region.tierBand;
  const ratio = hiLv === loLv ? 0 : (level - loLv) / (hiLv - loLv);
  return Math.round(loTier + ratio * (hiTier - loTier));
}

const MONSTER_BY_ID = new Map(MONSTERS.map((m) => [m.id, m]));

export function monsterById(id: string): Monster {
  const found = MONSTER_BY_ID.get(id);
  if (!found) throw new Error(`없는 몬스터: ${id}`);
  return found;
}

/** 그 지역의 보스 (T17_5). 1:1 전투 상대이자 다음 지역의 관문이다. */
export function bossOf(regionId: number): Monster {
  const boss = MONSTERS.find((m) => m.boss && m.region === regionId);
  if (!boss) throw new Error(`${regionId}지역에 보스가 없다`);
  return boss;
}

/** 그 티어의 일반 몬스터 전부 (보스 제외). 밸런스 벤치·시뮬레이터가 쓴다. */
export function monstersOfTier(tier: number): Monster[] {
  return MONSTERS.filter((m) => m.tier === tier && !m.boss);
}

// ─────────────────────────────────────────────────────────────
// 장비 (§4.5)
// ─────────────────────────────────────────────────────────────

/** 장비 정의 350종 = 티어 10 × 부위 7 × 등급 5. 인스턴스가 아니라 정의다. 고유 장비는 T17_7에 없앴다 */
export const EQUIPMENT = EquipmentsSchema.parse(equipmentRaw);

/** 물약·엘릭서 (§4.5). 공식이 없어서 생성물이 아니라 창작물을 그대로 읽는다. */
export const CONSUMABLES = ConsumablesSchema.parse(consumablesRaw);

export function consumableById(id: string): Consumable {
  const found = CONSUMABLES.find((c) => c.id === id);
  if (!found) throw new Error(`없는 소모품: ${id}`);
  return found;
}

/** 사냥터 35곳을 한 줄로. 검증이 쓴다. */
export const FIELDS = REGIONS.flatMap((r) => r.fields);

export function fieldById(id: string): Field {
  const found = FIELDS.find((f) => f.id === id);
  if (!found) throw new Error(`없는 사냥터: ${id}`);
  return found;
}

/** 그 사냥터가 속한 지역. 입장료·여관비가 지역을 타므로 자주 쓴다 (§4.1). */
export function regionOfField(fieldId: string): Region {
  const found = REGIONS.find((r) => r.fields.some((f) => f.id === fieldId));
  if (!found) throw new Error(`없는 사냥터: ${fieldId}`);
  return found;
}

/** 부위 이름. 화면이 "weapon" 대신 "무기"를 보여주려고 쓴다. */
export const GEAR_SLOT_LABELS = Object.fromEntries(
  EquipmentArchetypesSchema.parse(equipmentArchetypesRaw).slots.map((s) => [s.slot, s.label]),
) as Record<Equipment['slot'], string>;

const EQUIPMENT_BY_ID = new Map(EQUIPMENT.map((e) => [e.id, e]));

export function equipmentById(id: string): Equipment {
  const found = EQUIPMENT_BY_ID.get(id);
  if (!found) throw new Error(`없는 장비: ${id}`);
  return found;
}

/**
 * 그 레벨에서 낄 수 있는 **가장 높은 티어**의 한 벌 (§4.5).
 * 상점 진열(T14)과 밸런스 기준선이 같은 걸 봐야 해서 여기 둔다.
 * `region`을 주면 그 지역 티어까지만 본다 — 상점이 지금 지역 것만 팔아서다 (T17_6 검수).
 */
export function gearSetFor(
  level: number,
  region = REGION_COUNT,
  rarity: Equipment['rarity'] = 'common',
): Equipment[] {
  const grid = EQUIPMENT.filter((e) => e.region <= region);
  const tier = Math.max(...grid.filter((e) => e.level <= level).map((e) => e.tier));
  return grid.filter((e) => e.tier === tier && e.rarity === rarity);
}

/**
 * 상점 진열 — **지금 지역의 티어 두 개** (§4.5, T17_6 검수). 레벨이 아직 모자란 뒷단도 편다 —
 * 미리 사 둘 수 있다. 다음 지역 장비는 보스 보상으로만 먼저 만진다.
 * **전설은 드랍으로만** 나온다 (T17_6). 낮은 티어부터 (T19 검수 — 지금 낄 것이 위에).
 */
export function shopGear(region: number): Equipment[] {
  return EQUIPMENT.filter(
    (e) => (SHOP_RARITIES as readonly string[]).includes(e.rarity) && e.region === region,
  ).sort((a, b) => a.tier - b.tier);
}

/** 등급 그리드에서 장비 정의 하나를 찾는다 (드랍·보스 보상, T17_6). */
export function gridItem(tier: number, slot: GearSlot, rarity: GridRarity): Equipment {
  const found = EQUIPMENT.find((e) => e.tier === tier && e.slot === slot && e.rarity === rarity);
  if (!found) throw new Error(`없는 장비: 티어 ${tier} ${slot} ${rarity}`);
  return found;
}

/**
 * 그 사냥터를 돌 만한 레벨 (§7.2⑤). 풀의 평균 티어가 지역 대역에서 어디쯤인지를
 * 지역 레벨 구간에 그대로 옮긴다. 벤치·시뮬레이터·드랍 티어가 전부 이 하나를 본다.
 */
export function fieldLevel(field: Field): number {
  const region = regionOfField(field.id);
  const avgTier = field.pool.reduce((sum, [, t]) => sum + t, 0) / field.pool.length;
  const [loT, hiT] = region.tierBand;
  const [loL, hiL] = region.levelRange;
  return Math.round(loL + ((avgTier - loT) / (hiT - loT)) * (hiL - loL));
}

/**
 * 그 사냥터에서 떨어지는 장비의 티어 (T17_6). 지역의 장비 티어 두 개 중
 * **그 사냥터 적정 레벨에 낄 수 있는 높은 쪽**이다 — 앞쪽 사냥터는 앞단, 뒤쪽은 뒷단.
 */
export function fieldDropTier(field: Field): number {
  const region = regionOfField(field.id);
  const tiers = EQUIPMENT.filter((e) => e.region === region.id && e.rarity === 'common');
  const level = fieldLevel(field);
  const wearable = tiers.filter((e) => e.level <= level).map((e) => e.tier);
  return wearable.length > 0 ? Math.max(...wearable) : Math.min(...tiers.map((e) => e.tier));
}

/** 그 지역에서 파는 소모품 (§4.5). 아래 지역 것도 계속 판다. */
export function shopConsumables(region: number): Consumable[] {
  return CONSUMABLES.filter((c) => c.region <= region);
}
