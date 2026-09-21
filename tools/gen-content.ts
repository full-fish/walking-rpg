/**
 * 콘텐츠 생성 (§7.2④, §7.3). 원형 12개 × 지역 데이터 → 몬스터 정의.
 *
 * 창작물(archetypes/)을 읽어 생성물(data/)을 만든다. data/는 언제든 지우고 다시 만들 수 있다.
 * 산출물을 커밋하는 이유는 **밸런스를 건드렸을 때 숫자가 diff로 보이게** 하려는 것이다.
 * 커밋된 파일이 공식과 어긋나지 않는지는 validate가 매번 대조한다.
 */
import archetypesRaw from '../src/content/archetypes/monsters.json';
import regionsRaw from '../src/content/archetypes/regions.json';
import {
  MonsterArchetypesSchema,
  RegionsSchema,
  type Monster,
  type MonsterArchetype,
  type Region,
} from '../src/content/schema';
import { monsterExp, monsterGold, monsterStats, TIERS_PER_REGION } from '../src/game/formulas';

export const ARCHETYPES = MonsterArchetypesSchema.parse(archetypesRaw);
export const REGIONS = RegionsSchema.parse(regionsRaw);

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
