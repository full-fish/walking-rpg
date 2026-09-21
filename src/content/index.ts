/**
 * 콘텐츠 로더 (§7.3). 여기를 통해서만 게임 데이터를 읽는다.
 *
 * 앱이 켜지는 순간 검증하고, 틀렸으면 던진다. 잘못된 데이터로 조용히 도는 것보다
 * 즉시 죽는 게 낫다 — 원인이 몬스터 한 마리가 아니라 JSON 한 줄이기 때문이다.
 * 모든 오류를 한 번에 보고 싶으면 `npm run validate`를 쓴다.
 */
import equipmentArchetypesRaw from './archetypes/equipment.json';
import archetypesRaw from './archetypes/monsters.json';
import regionsRaw from './archetypes/regions.json';
import equipmentRaw from './data/items/equipment.json';
import region01 from './data/monsters/region-01.json';
import region02 from './data/monsters/region-02.json';
import region03 from './data/monsters/region-03.json';
import region04 from './data/monsters/region-04.json';
import region05 from './data/monsters/region-05.json';
import {
  EquipmentArchetypesSchema,
  EquipmentsSchema,
  MonsterArchetypesSchema,
  MonstersSchema,
  RegionsSchema,
  type Equipment,
  type Field,
  type Monster,
  type MonsterArchetype,
  type Region,
} from './schema';

export type { Equipment, Field, Monster, MonsterArchetype, Region };

/** 몬스터 원형 12개 (§7.2). */
export const MONSTER_ARCHETYPES = MonsterArchetypesSchema.parse(archetypesRaw);

/** 지역 5개와 사냥터 25개 (§7.2⑤). */
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

/** 그 티어의 일반 몬스터 전부 (보스 제외). 밸런스 벤치·시뮬레이터가 쓴다. */
export function monstersOfTier(tier: number): Monster[] {
  return MONSTERS.filter((m) => m.tier === tier && !m.boss);
}

// ─────────────────────────────────────────────────────────────
// 장비 (§4.5)
// ─────────────────────────────────────────────────────────────

/** 장비 정의 300종. 인스턴스가 아니라 정의다 — 개체는 세이브에 들어 있다. */
export const EQUIPMENT = EquipmentsSchema.parse(equipmentRaw);

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
 */
export function gearSetFor(level: number, rarity: Equipment['rarity'] = 'common'): Equipment[] {
  const tier = Math.max(...EQUIPMENT.filter((e) => e.level <= level).map((e) => e.tier));
  return EQUIPMENT.filter((e) => e.tier === tier && e.rarity === rarity);
}
