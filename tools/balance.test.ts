/**
 * `npm run balance` — 게임이 도는 숫자를 표로 모아 balance.md에 쓴다 (T17_7 검수 4차).
 *
 * 계획서는 "왜"를 적고, 이 파일은 "지금 얼마"를 적는다. **손으로 쓰지 않는다** — 검수마다 숫자가
 * 바뀌어서, 손으로 쓴 표는 한 번 고치고 나면 거짓말이 된다. 표는 전부 콘텐츠(data/)·공식(formulas)·
 * 시뮬(simulate)에서 뽑는다. 시드가 고정이라 같은 코드면 같은 파일이 나온다.
 */
import { writeFileSync } from 'node:fs';

import { expect, test } from 'vitest';

import {
  bossOf,
  CONSUMABLES,
  fieldDropTier,
  fieldLevel,
  GEAR_SLOT_LABELS,
  gearSetFor,
  gridItem,
  monstersOfField,
  REGIONS,
} from '../src/content';
import { makeRng } from '../src/game/battle';
import {
  BASE_STATS,
  BOSS_BUFF,
  BOSS_DROP_RARITY,
  combatStats,
  DROP_RARITY,
  DROP_RATE,
  enhanceCost,
  enhanceExpected,
  ENHANCE_MATERIALS,
  ENHANCE_MAX,
  ENHANCE_MULT,
  ENHANCE_RATE,
  evenSpend,
  EXPECTED_GEAR,
  expToNext,
  gearShare,
  GEAR_SLOTS,
  MATERIAL_CHANCE,
  materialChance,
  MIDNIGHT_WP,
  POINTS_PER_LEVEL,
  QUALITY_MAX,
  QUALITY_MIN,
  RARITIES,
  RARITY_MULT,
  RARITY_PRICE,
  referencePlayer,
  RING_BASE,
  RING_COST,
  RING_KINDS,
  RING_RARITY_MULT,
  RING_TIER_MULT,
  ringValue,
  RUN_SIZE_WEIGHTS,
  SHOP_RARITIES,
  SPD_RATIO_MAX,
  STARTING_STATS,
  STAT_PER_POINT,
  WP_COST,
} from '../src/game/formulas';
import { setBonus } from '../src/game/items';
import { enterBoss } from '../src/game/region';
import { RARITY_LABEL, RING_INFO } from '../src/ui/rings';
import { baselineSave, BUILDS, dayAtLevel, fight, simulate, type DayLog } from './simulate';

const OUT = 'balance.md';
const SEEDS = [1, 2, 3, 4, 5];
const STEPS = 10_000;
const CAP = { maxLevel: 50, maxDays: 400 };

/** 마크다운 표 한 개 */
function table(head: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}
const n0 = (v: number) => Math.round(v).toLocaleString('en-US');
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('en-US');
const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** 지역의 레벨 구간을 도는 동안의 하루 평균 (시뮬 로그에서) */
function regionDays(log: DayLog[], from: number, to: number) {
  const rows = log.filter((d) => d.level >= from && d.level < to);
  const avg = (pick: (d: DayLog) => number) => (rows.length ? mean(rows.map(pick)) : 0);
  return {
    days: rows.length / SEEDS.length,
    exp: avg((d) => d.exp),
    gold: avg((d) => d.gold),
    potion: avg((d) => d.potionCost),
    inn: avg((d) => d.innCost),
    entries: avg((d) => d.entries),
    kills: avg((d) => d.kills),
    deaths: avg((d) => d.deaths),
    clear: avg((d) => d.clearRate),
  };
}

/** 보스 승률 — 지역 끝 레벨 · 네 스탯 균등 · 보통 투자 한 벌 · 물약 3개 · 버프 n개 */
function bossRate(region: number, buffs: number, runs = 500): number {
  const r = REGIONS.find((x) => x.id === region)!;
  const base = baselineSave(r.levelRange[1], region);
  const materials = Object.fromEntries(r.fields.slice(0, BOSS_BUFF.max).map((f) => [f.id, 1]));
  let wins = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const rng = makeRng(seed);
    const inside = enterBoss({ ...base, materials }, buffs, rng)!;
    if (fight(inside, rng).outcome === 'win') wins++;
  }
  return wins / runs;
}

test('balance.md — 게임 숫자 한눈에', () => {
  const out: string[] = [];
  const h = (title: string, note?: string) =>
    out.push(`\n## ${title}\n` + (note ? `\n${note}\n` : ''));
  out.push(
    '# 밸런스 한눈에 (StepQuest)\n\n' +
      '> **`npm run balance`가 만든 파일입니다 — 손으로 고치지 마세요.** 콘텐츠·공식·시뮬에서 뽑습니다.\n' +
      '> 왜 이 값인지는 계획서(implementation_plan.v5.md)에 있습니다. 시뮬은 하루 10,000보, 시드 5개 평균입니다.',
  );

  // ── 빌드별 (시뮬) — 제일 오래 걸려서 먼저 돌린다
  const buildRuns = BUILDS.map((build) => ({
    build,
    runs: SEEDS.map((seed) => simulate({ steps: STEPS, build, ...CAP }, seed)),
  }));
  const balanced = buildRuns[0].runs;
  const lv50 = (runs: typeof balanced) => {
    const days = runs.map((r) => dayAtLevel(r.log, 50));
    return days.some((d) => d === undefined) ? undefined : mean(days as number[]);
  };

  h('1. 요약');
  out.push(
    table(
      ['항목', '값'],
      [
        ['Lv50까지 (균등, 하루 1만 보)', `${n1(lv50(balanced)!)}일`],
        ['레벨업마다 포인트', `${POINTS_PER_LEVEL}점 (자동 성장 없음)`],
        [
          '장비 몫 (common 풀세트)',
          `Lv1 ${pct(gearShare(1) / (1 + gearShare(1)))} → Lv50 ${pct(gearShare(50) / (1 + gearShare(50)))}`,
        ],
        [
          '보스 승률 (보통 투자, 버프 없이)',
          REGIONS.map((r) => pct(bossRate(r.id, 0))).join(' / '),
        ],
        ['보스 승률 (소재 3개 버프)', REGIONS.map((r) => pct(bossRate(r.id, 3))).join(' / ')],
        ['공속 (균등 기준 원형 대비)', `1.2배 · 상한 ${SPD_RATIO_MAX}배`],
        ['자정 기본 WP', n0(MIDNIGHT_WP)],
      ],
    ),
  );

  // ── 스탯
  h(
    '2. 스탯',
    '레벨업 한 번에 3점. 레벨이 올라도 자동으로 오르는 전투 스탯은 없습니다 — 찍은 만큼만 오릅니다.',
  );
  const lk = STAT_PER_POINT.luk;
  out.push(
    table(
      ['1차 스탯', '1점 효과', '전사 시작값'],
      [
        ['힘 STR', `ATK +${STAT_PER_POINT.str.atk}`, STARTING_STATS.warrior.str],
        [
          '체력 VIT',
          `HP +${STAT_PER_POINT.vit.maxHp} · DEF +${STAT_PER_POINT.vit.def}`,
          STARTING_STATS.warrior.vit,
        ],
        [
          '민첩 AGI',
          `SPD +${STAT_PER_POINT.agi.spd} · 회피 +${pct(STAT_PER_POINT.agi.eva, 1)}p`,
          STARTING_STATS.warrior.agi,
        ],
        [
          '행운 LUK',
          `치명 확률 +${pct(lk.cri, 1)}p · 드랍 +${pct(lk.dropRate)} · 골드 +${pct(lk.goldFind)}`,
          STARTING_STATS.warrior.luk,
        ],
      ],
    ),
  );
  out.push(
    `\n치명 피해는 ×${BASE_STATS.crd} 고정 · 치명 확률 기본 ${pct(BASE_STATS.cri)} · 회피 기본 ${pct(BASE_STATS.eva, 1)} · 치명 확률 상한 없음(100% 넘으면 늘 터짐)\n`,
  );

  out.push('\n**기준 플레이어 — 네 스탯 균등** (맨몸 → common 풀세트 → 그 지역 보통 투자 한 벌)\n');
  const refRows = [1, 8, 16, 26, 37, 50].map((level) => {
    const naked = combatStats(level);
    const common = combatStats(level, 'warrior', evenSpend(level), setBonus(gearSetFor(level)));
    const region = REGIONS.find((r) => level <= r.levelRange[1])!.id;
    const ref = referencePlayer(level, region);
    return [
      `Lv${level}`,
      `${n0(naked.maxHp)} / ${n0(common.maxHp)} / ${n0(ref.maxHp)}`,
      `${n0(naked.atk)} / ${n0(common.atk)} / ${n0(ref.atk)}`,
      `${n1(naked.def)} / ${n1(common.def)} / ${n1(ref.def)}`,
      `${n0(naked.spd)} / ${n0(common.spd)} / ${n0(ref.spd)}`,
      pct(naked.cri, 1),
      n0(expToNext(level)),
    ];
  });
  out.push(table(['레벨', 'HP', 'ATK', 'DEF', 'SPD', '치명', '다음 레벨 EXP'], refRows));

  out.push('\n**몰빵하면** — Lv50, common 풀세트, 147점을 한 스탯에 (균등 대비)\n');
  const gear50 = setBonus(gearSetFor(50));
  const even50 = combatStats(50, 'warrior', evenSpend(50), gear50);
  const none = { str: 0, vit: 0, agi: 0, luk: 0, int: 0 };
  out.push(
    table(
      ['몰빵', 'HP', 'ATK', 'SPD', '치명'],
      (['str', 'vit', 'agi', 'luk'] as const).map((k) => {
        const s = combatStats(50, 'warrior', { ...none, [k]: 147 }, gear50);
        const r = (a: number, b: number) => `${(a / b).toFixed(2)}배`;
        return [
          k.toUpperCase(),
          r(s.maxHp, even50.maxHp),
          r(s.atk, even50.atk),
          r(s.spd, even50.spd),
          pct(s.cri),
        ];
      }),
    ),
  );

  out.push('\n**빌드별 Lv50 도달** (시드 5개 평균)\n');
  out.push(
    table(
      ['빌드', '힘:체력:민첩:행운', 'Lv10', 'Lv30', 'Lv50', '사망/일', '완주율'],
      buildRuns.map(({ build, runs }) => {
        const at = (lv: number) => {
          const d = runs.map((r) => dayAtLevel(r.log, lv));
          return d.some((x) => x === undefined) ? '-' : n1(mean(d as number[]));
        };
        const log = runs.flatMap((r) => r.log);
        const w = build.weights;
        return [
          build.name,
          `${w.str}:${w.vit}:${w.agi}:${w.luk}`,
          at(10),
          at(30),
          at(50),
          mean(log.map((d) => d.deaths)).toFixed(2),
          pct(mean(log.map((d) => d.clearRate))),
        ];
      }),
    ),
  );

  // ── 장비
  h(
    '3. 장비 — 등급',
    '장비는 티어(1~10) × 부위(7) × 등급(5) = 350종. 이름·그림은 등급과 상관없이 같고, 등급은 테두리 색입니다.',
  );
  out.push(
    table(
      ['등급', '스탯 배율', '값 배율', '상점', '몬스터 드랍 비율', '보스 드랍 비율'],
      RARITIES.map((r) => [
        RARITY_LABEL[r],
        `×${RARITY_MULT[r]}`,
        `×${RARITY_PRICE[r]}`,
        SHOP_RARITIES.includes(r) ? '판다' : '안 판다',
        pct(DROP_RARITY[r] ?? 0),
        pct(BOSS_DROP_RARITY[r] ?? 0),
      ]),
    ),
  );
  out.push(
    `\n품질 ${pct(QUALITY_MIN)}~${pct(QUALITY_MAX)} (삼각분포, 100% 근처가 흔함) — 스탯에 곱한다.\n`,
  );

  h('4. 장비 — 티어별 이름과 common 스탯');
  const tiers = Array.from({ length: 10 }, (_, i) => i + 1);
  out.push(
    table(
      ['티어', '지역', '착용 Lv', ...GEAR_SLOTS.map((s) => GEAR_SLOT_LABELS[s]), '풀세트 값'],
      tiers.map((t) => {
        const set = GEAR_SLOTS.map((s) => gridItem(t, s, 'common'));
        return [
          t,
          set[0].region,
          set[0].level,
          ...set.map((e) => e.name),
          `${n0(set.reduce((a, e) => a + e.price, 0))}G`,
        ];
      }),
    ),
  );
  out.push('\n');
  out.push(
    table(
      [
        '티어',
        '무기 ATK',
        '투구 HP',
        '갑옷 DEF',
        '하의 HP/DEF',
        '장갑 ATK/HP',
        '신발 SPD',
        '장신구 LUK',
      ],
      tiers.map((t) => {
        const g = (s: (typeof GEAR_SLOTS)[number]) => gridItem(t, s, 'common');
        return [
          t,
          g('weapon').atk,
          g('helm').maxHp,
          g('armor').def,
          `${g('pants').maxHp}/${g('pants').def}`,
          `${g('gloves').atk}/${g('gloves').maxHp}`,
          g('boots').spd,
          g('accessory').luk,
        ];
      }),
    ),
  );

  h(
    '5. 강화',
    '실패해도 단계는 안 떨어지고 골드만 나갑니다. +6부터 소재는 성공할 때만 씁니다. 반지도 같은 표입니다.',
  );
  const price = gridItem(10, 'weapon', 'common').price;
  out.push(
    table(
      [
        '단계',
        '성공률',
        '스탯 배율',
        '비용 (장비값 대비)',
        `티어 10 무기 (${n0(price)}G)`,
        '소재 (서로 다른 사냥터)',
      ],
      Array.from({ length: ENHANCE_MAX }, (_, i) => [
        `+${i + 1}`,
        pct(ENHANCE_RATE[i]),
        `×${(ENHANCE_MULT ** (i + 1)).toFixed(2)}`,
        `${pct(enhanceCost(1000, i + 1) / 1000)}`,
        `${n0(enhanceCost(price, i + 1))}G`,
        ENHANCE_MATERIALS[i] || '-',
      ]),
    ),
  );
  out.push(
    `\n+10까지 기대 골드 (티어 10 무기) ${n0(enhanceExpected(price).gold)}G · 기대 시도 ${n1(enhanceExpected(price).tries)}회\n`,
  );

  // ── 반지
  h(
    '6. 반지',
    `2칸, 같은 반지 두 개 가능. 교환 ${RING_COST.exchange}개(초원) → ★1 일반 무작위. 올리기 ${RING_COST.rarity.join(' · ')}개(그 ★ 지역, 서로 다른 사냥터), 전설 → 다음 ★ 일반 ${RING_COST.tier}개(다음 지역). 올려도 강화 단계는 그대로.`,
  );
  out.push(
    table(
      ['★ \\ 등급', ...RARITIES.map((r) => RARITY_LABEL[r])],
      RING_TIER_MULT.map((m, i) => [
        `★${i + 1}`,
        ...RARITIES.map((r) => `×${(m * RING_RARITY_MULT[r]).toFixed(2)}`),
      ]),
    ),
  );
  out.push('\n(★1 일반 +0 = ×1. 강화 +n은 여기에 ×1.1^n)\n\n');
  out.push(
    table(
      ['반지', '★1 일반 +0', '★1 전설 +0', '★5 일반 +0', '★5 전설 +0', '★5 전설 +10'],
      RING_KINDS.map((k) => {
        const e = RING_INFO[k].effect;
        return [
          RING_INFO[k].name,
          e(RING_BASE[k]),
          e(ringValue(k, 1, 'legendary', 0)),
          e(ringValue(k, 5, 'common', 0)),
          e(ringValue(k, 5, 'legendary', 0)),
          e(ringValue(k, 5, 'legendary', 10)),
        ];
      }),
    ),
  );

  // ── 지역·사냥터·몬스터
  h('7. 지역');
  out.push(
    table(
      [
        '지역',
        '레벨',
        '티어',
        '보통 투자',
        '입장 WP',
        '보스 WP (첫/재)',
        '해금 WP',
        '여관',
        '물약',
      ],
      REGIONS.map((r) => {
        const potion = CONSUMABLES.filter((c) => c.region === r.id && c.heal > 0).at(-1);
        const g = EXPECTED_GEAR[r.id - 1];
        return [
          `${r.id}. ${r.name}`,
          r.levelRange.join('~'),
          r.tierBand.join('~'),
          `${RARITY_LABEL[g.rarity]} +${g.enhance}`,
          n0(WP_COST.fieldEntry(r.id)),
          `${n0(WP_COST.bossFirst(r.id))} / ${n0(WP_COST.bossRetry(r.id))}`,
          n0(WP_COST.regionUnlock(r.id)),
          `${r.town.inn}G`,
          potion ? `${potion.name} HP +${potion.heal} · ${potion.price}G` : '-',
        ];
      }),
    ),
  );

  h(
    '8. 사냥터 · 몬스터 · 드랍',
    `한 판 마릿수 ${RUN_SIZE_WEIGHTS.map(([n, w]) => `${n}마리 ${pct(w)}`).join(' · ')}. ` +
      `소재: 끝까지 깨면 ${Object.entries(MATERIAL_CHANCE)
        .map(([n, p]) => `${n}마리 ${pct(p!)}`)
        .join(' · ')} (4·5마리는 × 드랍 배율), 3마리 이하 0. ` +
      `장비 드랍: 처치마다 ${pct(DROP_RATE)} × 드랍 배율, 티어는 사냥터가, 부위는 몬스터가 정한다. ` +
      '몬스터 스탯은 그 티어 적정 레벨의 기준 플레이어를 따라간다.',
  );
  for (const r of REGIONS) {
    out.push(`\n### ${r.id}. ${r.name} (Lv${r.levelRange.join('~')})\n`);
    out.push(
      table(
        [
          '사냥터',
          '적정 Lv',
          '소재',
          '소재 확률 (4/5/6마리)',
          '장비 드랍 (처치당)',
          '드랍 티어',
          '몬스터 (티어) — HP · ATK · SPD · EXP · 골드 · 드랍 부위',
        ],
        r.fields.map((f) => {
          // 적정 레벨 기준 플레이어의 드랍 배율 (행운 균등 + 장신구)
          const drop = referencePlayer(fieldLevel(f), r.id).dropMult;
          return [
            f.name,
            fieldLevel(f),
            f.material.name,
            [4, 5, 6].map((size) => pct(materialChance(size, drop))).join(' / '),
            pct(DROP_RATE * drop, 1),
            fieldDropTier(f),
            monstersOfField(f)
              .map(
                (m) =>
                  `${m.name}(${m.tier}) ${n0(m.maxHp)}·${n1(m.atk)}·${n0(m.spd)}·${m.exp}·${m.gold}·${m.drop ? GEAR_SLOT_LABELS[m.drop] : '-'}`,
              )
              .join('<br>'),
          ];
        }),
      ),
    );
    const boss = bossOf(r.id);
    out.push(
      `\n보스 **${boss.name}** ×${r.boss.mult} — HP ${n0(boss.maxHp)} · ATK ${n1(boss.atk)} · DEF ${n1(boss.def)} · SPD ${n0(boss.spd)} · EXP ${boss.exp} · 골드 ${boss.gold}` +
        ` · 승률 버프 0/1/2/3개 ${[0, 1, 2, 3].map((b) => pct(bossRate(r.id, b))).join(' / ')}\n`,
    );
  }

  // ── 하루 (시뮬)
  h('9. 하루 (시뮬, 균등)', '입장은 WP가 정한다 — 하루 10,000보 + 자정 1,000 WP.');
  const log = balanced.flatMap((r) => r.log);
  out.push(
    table(
      [
        '지역',
        '머문 날',
        '입장/일',
        '처치/일',
        '완주율',
        '사망/일',
        'EXP/일',
        '골드/일',
        '물약/일',
        '여관/일',
        '유지비',
      ],
      REGIONS.map((r) => {
        const d = regionDays(log, r.levelRange[0], r.id === REGIONS.length ? 51 : r.levelRange[1]);
        return [
          r.id,
          n1(d.days),
          n1(d.entries),
          n1(d.kills),
          pct(d.clear),
          d.deaths.toFixed(2),
          n0(d.exp),
          n0(d.gold),
          n0(d.potion),
          n0(d.inn),
          pct((d.potion + d.inn) / Math.max(1, d.gold)),
        ];
      }),
    ),
  );

  // ── 소재 (시뮬로 모은 양 + 반지에 드는 양)
  const collected = mean(
    balanced.map((r) => {
      const left = Object.values(r.save.materials).reduce((a, b) => a + b, 0);
      return left + r.materialsUsed.enhance + r.materialsUsed.boss;
    }),
  );
  const perStar = RING_COST.rarity.reduce((a, b) => a + b, 0) + RING_COST.tier;
  h(
    '10. 소재와 반지 시간',
    `Lv50까지 모이는 소재 약 ${n0(collected)}개 (하루 약 ${n1(collected / lv50(balanced)!)}개). ` +
      `반지 ★ 하나를 일반 → 전설 → 다음 ★까지 ${perStar}개, 두 칸 ★5 전설 ${RING_COST.exchange * 2 + (perStar * 5 - RING_COST.tier) * 2}개.`,
  );
  out.push(
    table(
      ['목표', '소재', '소재를 전부 반지에 쓸 때'],
      [
        [
          '반지 하나 교환',
          RING_COST.exchange,
          `${n1(RING_COST.exchange / (collected / lv50(balanced)!))}일`,
        ],
        [
          '★ 하나 끝까지 (일반 → 다음 ★)',
          perStar,
          `${n1(perStar / (collected / lv50(balanced)!))}일`,
        ],
        [
          '한 칸 ★5 전설',
          RING_COST.exchange + perStar * 5 - RING_COST.tier,
          `${n1((RING_COST.exchange + perStar * 5 - RING_COST.tier) / (collected / lv50(balanced)!))}일`,
        ],
      ],
    ),
  );
  out.push('\n강화 +6~+10(장비 한 점 17개)과 보스 버프(관문마다 3개)도 같은 소재를 쓴다.\n');

  writeFileSync(OUT, out.join('\n') + '\n');
  expect(lv50(balanced)).toBeDefined();
}, 600_000);
