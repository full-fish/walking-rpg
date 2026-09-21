/**
 * 콘텐츠 생성 (§7.2④, §7.3). 원형 12개 × 지역 데이터 → 몬스터 정의.
 *
 * 창작물(archetypes/)을 읽어 생성물(data/)을 만든다. data/는 언제든 지우고 다시 만들 수 있다.
 * 산출물을 커밋하는 이유는 **밸런스를 건드렸을 때 숫자가 diff로 보이게** 하려는 것이다.
 * 커밋된 파일이 공식과 어긋나지 않는지는 validate가 매번 대조한다.
 */
import equipmentRaw from '../src/content/archetypes/equipment.json';
import archetypesRaw from '../src/content/archetypes/monsters.json';
import regionsRaw from '../src/content/archetypes/regions.json';
import {
  EquipmentArchetypesSchema,
  MonsterArchetypesSchema,
  RegionsSchema,
  type Equipment,
  type Monster,
  type MonsterArchetype,
  type Region,
} from '../src/content/schema';
import {
  GEAR_TIERS_PER_REGION,
  gearPrice,
  gearStats,
  monsterExp,
  monsterGold,
  monsterStats,
  RARITIES,
  TIERS_PER_REGION,
  UNIQUE_RARITY,
} from '../src/game/formulas';

export const ARCHETYPES = MonsterArchetypesSchema.parse(archetypesRaw);
export const REGIONS = RegionsSchema.parse(regionsRaw);
export const EQUIPMENT_ARCHETYPES = EquipmentArchetypesSchema.parse(equipmentRaw);

/** 지역 안에서 몇 번째 티어인가 (1~5). 보상 공식이 이 값을 쓴다 (§6.2, §6.3). */
export function tierInRegion(tier: number, region: number): number {
  return tier - (region - 1) * TIERS_PER_REGION;
}

function build(
  arch: MonsterArchetype,
  tier: number,
  region: Region,
  name: string,
  id: string,
  boss = false,
): Monster {
  const t = tierInRegion(tier, region.id);
  return {
    id,
    name,
    region: region.id,
    tier,
    arch: arch.id,
    power: arch.power,
    sprite: `${arch.spriteTag}_${tier}`,
    ...monsterStats(tier, region.difficulty, arch.power, arch.statBias),
    cri: arch.cri,
    crd: 1.5,
    eva: arch.eva,
    // 보상도 power에 비례한다 — 센 원형이 떴을 때 손해가 아니라 이득이어야 한다 (§7.2④)
    exp: Math.round(monsterExp(region.id, t, arch.power)),
    gold: Math.round(monsterGold(region.id, t, arch.power)),
    traits: arch.traits,
    ...(boss ? { boss: true } : {}),
  };
}

/** 지역 하나의 몬스터 전부. 그 지역 티어 대역에 걸친 원형을 모으고 보스를 더한다. */
export function generateRegion(region: Region): Monster[] {
  const [lo, hi] = region.tierBand;
  const monsters: Monster[] = [];

  for (const arch of ARCHETYPES) {
    arch.tiers.forEach((tier, i) => {
      if (tier < lo || tier > hi) return;
      const suffix = arch.id.replace('arch_', '');
      monsters.push(build(arch, tier, region, arch.namePool[i], `mon_t${tier}_${suffix}`));
    });
  }

  const bossArch = ARCHETYPES.find((a) => a.id === region.boss.arch);
  if (!bossArch) throw new Error(`${region.id}지역 보스의 원형이 없다: ${region.boss.arch}`);
  monsters.push(
    build(bossArch, region.boss.tier, region, region.boss.name, `mon_r${region.id}_boss`, true),
  );

  return monsters.sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
}

/** 지역번호 → 그 지역 몬스터. data/monsters/region-0N.json이 될 내용 그대로다. */
export function generateAll(): Map<number, Monster[]> {
  return new Map(REGIONS.map((r) => [r.id, generateRegion(r)]));
}

// ─────────────────────────────────────────────────────────────
// 장비 (§4.5)
// ─────────────────────────────────────────────────────────────

export type GearTier = { tier: number; region: number; reqLevel: number; refLevel: number };

/**
 * 장비 티어 10단계가 덮는 레벨 구간 (§4.5).
 *
 * 지역마다 레벨 구간을 반으로 잘라 2단계씩 가져간다 — 지역에 들어갈 때 한 벌,
 * 중간에서 한 벌. `refLevel`은 **그 구간의 한가운데**이고 스탯은 이 레벨 기준으로 뽑는다.
 * 살 때는 조금 넘치고 구간 끝에서는 조금 모자라게 되는데, 그 톱니가 "슬슬 갈아야겠다"다.
 */
export function gearTierLevels(): GearTier[] {
  const regions = [...REGIONS].sort((a, b) => a.id - b.id);
  const reqs = regions.flatMap((r) => {
    const [lo, hi] = r.levelRange;
    const first = (r.id - 1) * GEAR_TIERS_PER_REGION + 1;
    return [
      { tier: first, region: r.id, reqLevel: lo },
      { tier: first + 1, region: r.id, reqLevel: Math.round((lo + hi) / 2) },
    ];
  });

  const maxLevel = regions.at(-1)!.levelRange[1];
  return reqs.map((x, i) => {
    const end = i + 1 < reqs.length ? reqs[i + 1].reqLevel - 1 : maxLevel;
    return { ...x, refLevel: Math.round((x.reqLevel + end) / 2) };
  });
}

/** 장비 정의 300종 = 티어 10 × 부위 6 × 등급 5 (§7.2). */
export function generateEquipment(): Equipment[] {
  const { tierNames, slots } = EQUIPMENT_ARCHETYPES;
  const out: Equipment[] = [];

  for (const { tier, region, reqLevel, refLevel } of gearTierLevels()) {
    for (const arch of slots) {
      for (const rarity of RARITIES) {
        out.push({
          id: `eq_t${tier}_${arch.slot}_${rarity}`,
          name: `${tierNames[tier - 1]} ${arch.namePool[rarity]}`,
          tier,
          slot: arch.slot,
          rarity,
          level: reqLevel,
          region,
          sprite: `${arch.spriteTag}_${tier}`,
          ...gearStats(refLevel, arch.slot, rarity),
          // 값은 티어가 아니라 **그 장비가 실제로 주는 몫**을 따른다 (§4.5)
          price: gearPrice(refLevel, arch.slot, rarity),
        });
      }
    }
  }
  return out;
}

/**
 * 사냥터 고유 장비 25종 (§4.4, §4.5).
 *
 * 그리드(티어 × 부위 × 등급) 밖이다 — **사냥터 한 곳에 하나씩** 붙는다.
 * 티어는 그 지역의 뒷단 장비 티어고, 성능은 같은 티어 common과 rare 사이(1.25배)다.
 * 골드로는 못 산다. 소재 3개 + 골드로만 바꾼다.
 */
export function generateUniques(): Equipment[] {
  const byRegion = new Map(gearTierLevels().map((g) => [g.region, g]));

  return [...REGIONS]
    .sort((a, b) => a.id - b.id)
    .flatMap((region) => {
      // Map이 지역마다 마지막 것을 남기므로 **뒷단 티어**다 — 그 지역을 다 돌 때쯤 맞추는 물건
      const gear = byRegion.get(region.id)!;
      return region.fields.map(
        (field): Equipment => ({
          id: field.reward.id,
          name: field.reward.name,
          tier: gear.tier,
          slot: field.reward.slot,
          rarity: UNIQUE_RARITY,
          level: gear.reqLevel,
          region: region.id,
          sprite: `uniq_${field.id}`,
          ...gearStats(gear.refLevel, field.reward.slot, UNIQUE_RARITY),
          price: gearPrice(gear.refLevel, field.reward.slot, UNIQUE_RARITY),
        }),
      );
    });
}
