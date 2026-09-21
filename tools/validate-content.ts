/**
 * 콘텐츠 검증 (§7.4). `npm run validate`
 *
 * 스키마는 데이터 하나하나를 보고, 여기서는 **데이터끼리의 관계**를 본다 —
 * 중복, 참조 무결성, 밸런스 불변식이 그것이다.
 * 오류를 던지지 않고 모아서 돌려준다. 하나 고치고 다시 돌리는 걸 12번 반복하지 않기 위해서다.
 *
 * §7.4 7번(스프라이트 파일 존재)은 아직 파일이 하나도 없어서 넣지 않았다.
 */
import raw from '../src/content/archetypes/monsters.json';
import { CONSUMABLES, EQUIPMENT, MONSTERS, REGIONS, UNIQUES } from '../src/content';
import { MonsterArchetypesSchema, type Monster } from '../src/content/schema';
import {
  combatStats,
  gearSetPrice,
  gearShare,
  GEAR_SLOTS,
  GEAR_SPD_RATE,
  FIELDS_PER_REGION,
  innCost,
  powerScale,
  RARITY_MULT,
} from '../src/game/formulas';
import { setBonus } from '../src/game/items';
import {
  generateAll,
  generateEquipment,
  gearTierLevels,
  generateUniques,
  tierInRegion,
} from './gen-content';

/** 키 순서에 안 흔들리게 비교한다 — zod parse는 스키마 순서로 키를 다시 깐다. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

/** 두 번 이상 나온 값만 골라낸다. */
function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

/**
 * 빈 배열이면 통과. 스키마부터 틀렸으면 스키마 오류만 돌려준다 —
 * 형식이 깨진 데이터에 중복 검사를 돌려봐야 의미 없는 오류만 더 나온다.
 *
 * data를 받는 건 테스트가 일부러 깨진 데이터를 넣어보기 위해서다. T11의 gen-content.ts도
 * 생성 직후 결과물을 파일로 쓰기 전에 이 함수에 통과시킨다.
 */
export function validateContent(data: unknown = raw): string[] {
  const parsed = MonsterArchetypesSchema.safeParse(data);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => `[스키마] ${i.path.join('.') || '(root)'} — ${i.message}`);
  }

  const archetypes = parsed.data;
  const errors: string[] = [];

  // §7.4 #3 — ID 중복 없음
  for (const id of duplicates(archetypes.map((a) => a.id))) {
    errors.push(`[ID 중복] ${id}`);
  }

  // §7.4 #5 — 몬스터 이름 중복 없음. 이름이 곧 강함의 순서라 겹치면 순서가 깨진다 (§7.2②)
  for (const name of duplicates(archetypes.flatMap((a) => a.namePool))) {
    errors.push(`[이름 중복] ${name}`);
  }

  return errors;
}

/** 사냥터 평균 power 허용 오차 (§7.4 #6). 벗어나면 그 사냥터만 유독 짜거나 후해진다. */
const POWER_TOLERANCE = 0.15;

/**
 * 생성물(data/)과 창작물(archetypes/)의 관계를 본다 — §7.4 2·6번.
 *
 * 커밋된 JSON이 공식과 어긋나는 경우가 제일 무섭다. 아무도 안 보는 사이에
 * 밸런스가 조용히 달라지기 때문이다. 그래서 매번 새로 뽑아 통째로 대조한다.
 */
export function validateGenerated(): string[] {
  const errors: string[] = [];
  const fresh = generateAll();

  for (const region of REGIONS) {
    const committed = MONSTERS.filter((m) => m.region === region.id);
    const expected = fresh.get(region.id) ?? [];
    if (canonical(committed) !== canonical(expected)) {
      errors.push(`[생성물 낡음] 지역 ${region.id} — npm run gen을 다시 돌려라`);
    }

    // §7.4 #2 — 사냥터 pool이 가리키는 몬스터가 실제로 있는가
    for (const field of region.fields) {
      for (const [arch, tier] of field.pool) {
        const found = MONSTERS.some((m) => m.arch === arch && m.tier === tier && !m.boss);
        if (!found) errors.push(`[참조 깨짐] ${field.id} → ${arch} 티어 ${tier}`);
        const [lo, hi] = region.tierBand;
        if (tier < lo || tier > hi) {
          errors.push(`[티어 대역 밖] ${field.id} → 티어 ${tier} (지역 ${region.id}: ${lo}~${hi})`);
        }
      }

      // §7.4 #6 — 사냥터 평균 power = 1.0 ± 0.15
      const powers = field.pool.map(([arch]) => {
        const m = MONSTERS.find((x) => x.arch === arch);
        return m?.power ?? 0;
      });
      const avg = powers.reduce((a, b) => a + b, 0) / powers.length;
      if (Math.abs(avg - 1) > POWER_TOLERANCE) {
        errors.push(`[사냥터 power] ${field.id} 평균 ${avg.toFixed(3)} (1.0 ± ${POWER_TOLERANCE})`);
      }
    }

    // §7.4 #6 — 보스 원형이 있는가
    if (!MONSTERS.some((m) => m.boss && m.region === region.id)) {
      errors.push(`[보스 없음] 지역 ${region.id}`);
    }
  }

  // §7.4 #6 — 티어가 오르면 HP/ATK가 단조 증가한다 (같은 원형 안에서)
  for (const arch of new Set(MONSTERS.map((m) => m.arch))) {
    const line = MONSTERS.filter((m) => m.arch === arch && !m.boss).sort((a, b) => a.tier - b.tier);
    for (let i = 1; i < line.length; i++) {
      if (line[i].maxHp <= line[i - 1].maxHp || line[i].atk <= line[i - 1].atk) {
        errors.push(`[단조 증가 깨짐] ${arch}: ${line[i - 1].name} → ${line[i].name}`);
      }
    }
  }

  // §7.4 #6 — 보상이 power에 비례한다 (§7.2④). 같은 (지역, 지역내 티어)면 exp ÷ power가 같아야 한다.
  //
  // exp는 정수로 반올림돼 있어서 그냥 나누면 power가 작을수록 크게 흔들린다.
  // 그래서 몬스터마다 "원래 값이 이 구간 안이었다"는 [(exp-0.5)/power, (exp+0.5)/power]를 만들고,
  // 같은 티어끼리 그 구간이 겹치는지 본다. 겹치지 않으면 비례가 아니다 — 임의의 오차값이 필요 없다.
  const byTier = new Map<string, Monster[]>();
  for (const m of MONSTERS) {
    const key = `${m.region}-${tierInRegion(m.tier, m.region)}`;
    byTier.set(key, [...(byTier.get(key) ?? []), m]);
  }
  for (const [key, group] of byTier) {
    for (const field of ['exp', 'gold'] as const) {
      const lo = Math.max(...group.map((m) => (m[field] - 0.5) / m.power));
      const hi = Math.min(...group.map((m) => (m[field] + 0.5) / m.power));
      if (lo > hi) {
        const shown = group.map((m) => `${m.name} ${(m[field] / m.power).toFixed(1)}`).join(', ');
        errors.push(`[${field}가 power에 비례하지 않음] 지역-티어 ${key}: ${shown}`);
      }
    }
  }

  // §7.4 #6 — 사냥터마다 고유 소재/장비가 1:1로 있는가 (#8)
  const fields = REGIONS.flatMap((r) => r.fields);
  const ids = [
    ...fields.map((f) => f.id),
    ...fields.map((f) => f.material.id),
    ...fields.map((f) => f.reward.id),
  ];
  for (const id of duplicates(ids)) errors.push(`[사냥터 ID 중복] ${id}`);

  errors.push(...validateEquipment());
  errors.push(...validateEconomy());
  return errors;
}

/**
 * 경제 (§4.5, §3.7, §7.4) — T14.
 *
 * 값이 두 군데 적혀 있으면 언젠가 갈라진다. 여관비는 regions.json에 박혀 있고
 * 공식은 formulas.ts에 있으므로 **매번 대조**한다.
 */
function validateEconomy(): string[] {
  const errors: string[] = [];

  for (const region of REGIONS) {
    const want = innCost(region.id);
    if (region.town.inn !== want) {
      errors.push(`[여관비] 지역 ${region.id} — ${region.town.inn} (공식 ${want})`);
    }
  }

  // §4.5 물약 표 — 지역마다 하나씩, 뒤로 갈수록 많이 회복하고 비싸다
  for (const id of duplicates(CONSUMABLES.map((c) => c.id))) errors.push(`[소모품 ID 중복] ${id}`);
  const potions = CONSUMABLES.filter((c) => c.heal > 0);
  for (let i = 1; i < potions.length; i++) {
    if (potions[i].heal <= potions[i - 1].heal || potions[i].price <= potions[i - 1].price) {
      errors.push(`[물약 순서] ${potions[i - 1].name} → ${potions[i].name}`);
    }
  }

  // §4.4 — 사냥터 25곳에 고유 장비가 1:1로 있고, 지역마다 5부위가 안 겹친다
  if (UNIQUES.length !== REGIONS.length * FIELDS_PER_REGION) {
    errors.push(`[고유 장비 수] ${UNIQUES.length}종 (사냥터 ${REGIONS.length * FIELDS_PER_REGION}곳)`);
  }
  if (canonical(UNIQUES) !== canonical(generateUniques())) {
    errors.push('[생성물 낡음] 고유 장비 — npm run gen을 다시 돌려라');
  }
  for (const region of REGIONS) {
    const slots = region.fields.map((f) => f.reward.slot);
    if (new Set(slots).size !== slots.length) {
      errors.push(`[고유 장비 부위 겹침] 지역 ${region.id} — ${slots.join(', ')}`);
    }
    for (const field of region.fields) {
      if (!UNIQUES.some((u) => u.id === field.reward.id)) {
        errors.push(`[참조 깨짐] ${field.id}의 고유 장비 ${field.reward.id}가 없다`);
      }
    }
  }

  // §4.5 — 고유 장비는 같은 티어 common보다 세고 rare보다 약하다
  for (const u of UNIQUES) {
    const peers = EQUIPMENT.filter((e) => e.tier === u.tier && e.slot === u.slot);
    const common = peers.find((e) => e.rarity === 'common');
    const rare = peers.find((e) => e.rarity === 'rare');
    if (!common || !rare) continue;
    // 낮은 티어는 스탯이 한 자릿수라 정수 반올림이 배율 차이를 먹는다. 순서만 본다
    const power = (e: typeof u) => e.atk + e.maxHp + e.def;
    if (power(u) < power(common) || power(u) > power(rare)) {
      errors.push(
        `[고유 장비 성능] ${u.name} — common ${power(common)} ≤ ${power(u)} ≤ rare ${power(rare)}이어야 한다`,
      );
    }
  }
  if (RARITY_MULT.unique <= RARITY_MULT.common || RARITY_MULT.unique >= RARITY_MULT.rare) {
    errors.push(`[고유 배율] ${RARITY_MULT.unique} — common과 rare 사이여야 한다`);
  }

  return errors;
}

/** 장비 스탯 기준선 허용 오차. 반올림 말고 다른 이유로 벗어나면 공식이 어긋난 것이다. */
const GEAR_TOLERANCE = 0.05;
/** 풀세트 값이 "그 지역 하루 수입 1일치"에서 얼마나 떨어져도 되는가 (§4.5). */
const PRICE_TOLERANCE = 0.02;

/**
 * 장비 (§4.5, §7.4 #6).
 *
 * 제일 중요한 건 **기준선**이다 — 그 티어 common 풀세트를 입으면 전투력이
 * 정확히 powerScale(레벨)배가 되어야 한다. 이게 어긋나면 몬스터 곡선과 다시 벌어진다.
 */
function validateEquipment(): string[] {
  const errors: string[] = [];

  // 등급 그리드만 본다. 고유 25종은 그리드 밖이라 validateEconomy가 따로 본다
  const grid = EQUIPMENT.filter((e) => e.rarity !== 'unique');
  if (canonical(grid) !== canonical(generateEquipment())) {
    errors.push('[생성물 낡음] 장비 — npm run gen을 다시 돌려라');
  }

  for (const id of duplicates(EQUIPMENT.map((e) => e.id))) errors.push(`[장비 ID 중복] ${id}`);
  for (const name of duplicates(EQUIPMENT.map((e) => e.name))) {
    errors.push(`[장비 이름 중복] ${name}`);
  }

  for (const { tier, refLevel } of gearTierLevels()) {
    const set = EQUIPMENT.filter((e) => e.tier === tier && e.rarity === 'common');
    if (set.length !== GEAR_SLOTS.length) {
      errors.push(`[장비 부위 빠짐] 티어 ${tier} — ${set.length}/${GEAR_SLOTS.length}부위`);
      continue;
    }

    // 기준선: 맨몸 + common 풀세트 = 맨몸 × powerScale
    const naked = combatStats(refLevel);
    const gear = setBonus(set);
    // 목표 배수 = 1 + gearShare (powerScale에 GEAR_FLOOR가 더 얹힌다, §4.5)
    const target = 1 + gearShare(refLevel);
    // SPD만 목표가 다르다 — gearShare를 안 쓰고 레벨과 무관하게 +15%다 (§4.5)
    for (const [label, got, base, want] of [
      ['ATK', naked.atk + gear.atk, naked.atk, naked.atk * target],
      ['HP', naked.maxHp + gear.maxHp, naked.maxHp, naked.maxHp * target],
      ['DEF', naked.def + gear.def, naked.def, naked.def * target],
      ['SPD', naked.spd + gear.spd, naked.spd, naked.spd * (1 + GEAR_SPD_RATE)],
    ] as const) {
      // 부위마다 정수로 반올림하므로 최악이 6칸 × 0.5 = 3이다. 그만큼은 봐준다 —
      // 티어 1 DEF처럼 몫 자체가 1도 안 되는 칸이 여기 걸린다
      const slack = Math.max(GEAR_SLOTS.length / 2, want * GEAR_TOLERANCE);
      if (Math.abs(got - want) > slack) {
        errors.push(
          `[장비 기준선] 티어 ${tier} ${label} — Lv${refLevel}에서 ${(got / base).toFixed(2)}배 (목표 ${target.toFixed(2)}배)`,
        );
      }
    }

    // §4.5 — 값은 **그 장비가 실제로 주는 몫**에 비례한다. 티어와는 무관하다
    const price = set.reduce((sum, e) => sum + e.price, 0);
    const want = gearSetPrice(refLevel);
    if (Math.abs(price - want) / want > PRICE_TOLERANCE) {
      errors.push(`[풀세트 가격] 티어 ${tier} — ${price}골드 (목표 ${Math.round(want)})`);
    }
  }

  // §7.4 #6 — 티어가 오르면 장비가 세진다. 같은 부위·등급 안에서 단조 증가
  for (const slot of GEAR_SLOTS) {
    const line = EQUIPMENT.filter((e) => e.slot === slot && e.rarity === 'common').sort(
      (a, b) => a.tier - b.tier,
    );
    for (let i = 1; i < line.length; i++) {
      const sum = (e: (typeof line)[number]) => e.atk + e.maxHp + e.def + e.spd;
      if (sum(line[i]) <= sum(line[i - 1])) {
        errors.push(`[장비 단조 증가 깨짐] ${line[i - 1].name} → ${line[i].name}`);
      }
    }
  }

  return errors;
}
