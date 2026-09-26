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
  ARROW_NAMES,
  ARROWS,
  bossOf,
  consumableById,
  CONSUMABLES,
  fieldDropTier,
  fieldLevel,
  GEAR_LINE_LABELS,
  GEAR_SLOT_LABELS,
  gearSetFor,
  gridItem,
  monstersOfField,
  REGIONS,
  type Monster,
  type Region,
} from '../src/content';
import { makeRng, simulateBattle, type Combatant } from '../src/game/battle';
import { regionPotion, rewardGold } from '../src/game/daily';
import { DEX_MONSTERS, dexStat } from '../src/game/dex';
import {
  BASE_STATS,
  BOSS_DROP_RARITY,
  combatStats,
  DEX,
  DEX_MAX,
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
  styleLines,
  type GearLine,
  MATERIAL_BUFF,
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
  SPENDABLE_STATS,
  STARTING_STATS,
  STAT_PER_POINT,
  STEP_GOAL,
  STEP_GOAL_REWARDS,
  STREAK_REWARDS,
  withLegendary,
  WP_COST,
  ARROW,
  ARROW_DROP,
  HAND_LINES,
  STYLE_HANDS,
  STYLE_TRAIT,
  STYLES,
  SPECIAL_ARROWS,
  type DailyReward,
  type Style,
} from '../src/game/formulas';
import { setBonus } from '../src/game/items';
import { statsOf } from '../src/game/progression';
import { enterBoss } from '../src/game/region';
import type { Save } from '../src/save/schema';
import { BOSS_REWARDS, DEX_REVEAL, STAT_LABEL } from '../src/ui/dexText';
import { RARITY_LABEL, RING_INFO } from '../src/ui/rings';
import {
  ARROW_EFFECT_TEXT,
  SKILL_CYCLE,
  SKILL_LABEL,
  SKILL_TEXT,
  STYLE_LABEL,
  STYLE_TRAIT_TEXT,
} from '../src/ui/styleText';
import {
  baselineSave,
  bossTrial,
  BUILDS,
  dayAtLevel,
  fight,
  simulate,
  type DayLog,
} from './simulate';

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

/** 그 빌드로 배분한 기준 세이브 — 장비·물약은 baselineSave 그대로. `style`은 무기 계열 (T18) */
function buildSave(
  level: number,
  region: number,
  weights: Record<string, number>,
  style: Style = 'sword',
): Save {
  const base = baselineSave(level, region, style);
  const total = (level - 1) * POINTS_PER_LEVEL;
  const keys = ['str', 'vit', 'agi', 'luk'] as const;
  const sum = keys.reduce((a, k) => a + weights[k], 0);
  const pts = Object.fromEntries(keys.map((k) => [k, Math.floor((total * weights[k]) / sum)]));
  let left = total - keys.reduce((a, k) => a + pts[k], 0);
  for (const k of keys) {
    if (left > 0 && weights[k] > 0) {
      pts[k] += 1;
      left -= 1;
    }
  }
  const save: Save = { ...base, statPoints: { ...base.statPoints, ...pts } };
  return { ...save, player: { ...save.player, hp: statsOf(save).maxHp } };
}

/** 빌드마다 버프 없이 보스를 30% 이기는 보스 배율을 이분 탐색으로 — 균등 대비 */
function buildPower(
  level: number,
  region: number,
  runs = 300,
  style: Style = 'sword',
  builds = BUILDS,
): number[] {
  const boss = bossOf(region);
  const found = builds.map((b) => {
    const save = buildSave(level, region, b.weights, style);
    const rate = (f: number) => {
      const m = {
        ...boss,
        maxHp: Math.round(boss.maxHp * f),
        atk: boss.atk * f,
        def: boss.def * f,
      };
      let wins = 0;
      for (let seed = 1; seed <= runs; seed++) {
        if (fight(enterBoss(save)!, makeRng(seed), m).outcome === 'win') wins++;
      }
      return wins / runs;
    };
    let lo = 0.3;
    let hi = 2.5;
    for (let i = 0; i < 9; i++) {
      const mid = (lo + hi) / 2;
      if (rate(mid) > 0.3) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  });
  return found.map((f) => f / found[0]);
}

const transpose = (cols: number[][]) => cols[0].map((_, i) => cols.map((c) => c[i]));

/** 보스 승률 — 지역 끝 레벨 · 네 스탯 균등 · 보통 투자 한 벌 · 물약 3개 · 버프 n개 */
function bossRate(region: number, buffs: number, runs = 500): number {
  const r = REGIONS.find((x) => x.id === region)!;
  const base = baselineSave(r.levelRange[1], region);
  const materials = Object.fromEntries(r.fields.slice(0, MATERIAL_BUFF.max).map((f) => [f.id, 1]));
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
      ['1차 스탯', '1점 효과', '시작값'],
      [
        [
          '힘 STR',
          `ATK +${STAT_PER_POINT.str.atk} · 치명 피해 +${STAT_PER_POINT.str.crd}배`,
          STARTING_STATS.str,
        ],
        [
          '체력 VIT',
          `HP +${STAT_PER_POINT.vit.maxHp} · DEF +${STAT_PER_POINT.vit.def}`,
          STARTING_STATS.vit,
        ],
        [
          '민첩 AGI',
          `SPD +${STAT_PER_POINT.agi.spd} · 회피 +${pct(STAT_PER_POINT.agi.eva, 1)}p`,
          STARTING_STATS.agi,
        ],
        [
          '행운 LUK',
          `치명 확률 +${pct(lk.cri, 1)}p · 드랍 +${pct(lk.dropRate)} · 골드 +${pct(lk.goldFind)}`,
          STARTING_STATS.luk,
        ],
      ],
    ),
  );
  out.push(
    `\n치명 피해 = ${BASE_STATS.crd} + 힘 × ${STAT_PER_POINT.str.crd} (Lv1 ×${combatStats(1).crd}) · 치명 확률 기본 ${pct(BASE_STATS.cri)} · 회피 기본 ${pct(BASE_STATS.eva, 1)} · 치명 확률 상한 없음(100% 넘으면 늘 터짐)\n` +
      '장비도 1차 스탯을 준다 — 장갑 STR(치명 피해까지) · 신발 AGI(회피까지) · 장신구 LUK. 아래 표의 치명은 그걸 다 친 값이다.\n',
  );

  out.push('\n**기준 플레이어 — 네 스탯 균등** (맨몸 → common 풀세트 → 그 지역 보통 투자 한 벌)\n');
  const refRows = [1, 8, 16, 26, 37, 50].map((level) => {
    const naked = combatStats(level);
    const common = combatStats(level, evenSpend(level), setBonus(gearSetFor(level)));
    const region = REGIONS.find((r) => level <= r.levelRange[1])!.id;
    const ref = referencePlayer(level, region);
    return [
      `Lv${level}`,
      `${n0(naked.maxHp)} / ${n0(common.maxHp)} / ${n0(ref.maxHp)}`,
      `${n0(naked.atk)} / ${n0(common.atk)} / ${n0(ref.atk)}`,
      `${n1(naked.def)} / ${n1(common.def)} / ${n1(ref.def)}`,
      `${n0(naked.spd)} / ${n0(common.spd)} / ${n0(ref.spd)}`,
      `${pct(ref.cri)} ×${ref.crd.toFixed(2)}`,
      pct(ref.eva, 1),
      n0(expToNext(level)),
    ];
  });
  out.push(
    table(
      ['레벨', 'HP', 'ATK', 'DEF', 'SPD', '치명 (보통 투자)', '회피', '다음 레벨 EXP'],
      refRows,
    ),
  );

  out.push('\n**몰빵하면** — Lv50, common 풀세트, 147점을 한 스탯에 (균등 대비)\n');
  const gear50 = setBonus(gearSetFor(50));
  const even50 = combatStats(50, evenSpend(50), gear50);
  const none = { str: 0, vit: 0, agi: 0, luk: 0 };
  out.push(
    table(
      ['몰빵', 'HP', 'ATK', 'SPD', '치명', '치명 피해'],
      (['str', 'vit', 'agi', 'luk'] as const).map((k) => {
        const s = combatStats(50, { ...none, [k]: 147 }, gear50);
        const r = (a: number, b: number) => `${(a / b).toFixed(2)}배`;
        return [
          k.toUpperCase(),
          r(s.maxHp, even50.maxHp),
          r(s.atk, even50.atk),
          r(s.spd, even50.spd),
          pct(s.cri),
          `×${s.crd.toFixed(2)}`,
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

  out.push(
    '\n**빌드별 전투력** — 같은 장비(보통 투자 한 벌)로 버프 없이 **보스를 30% 이기는 보스 세기** (균등 = 1.00, HP·ATK·DEF를 같이 곱한 배율)\n',
  );
  const powerLevels = [
    [26, 3],
    [50, 5],
  ] as const;
  out.push(
    table(
      ['빌드', ...powerLevels.map(([lv]) => `Lv${lv}`)],
      transpose(powerLevels.map(([lv, region]) => buildPower(lv, region))).map((row, i) => [
        BUILDS[i].name,
        ...row.map((v) => v.toFixed(2)),
      ]),
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
    `\n품질 ${pct(QUALITY_MIN)}~${pct(QUALITY_MAX)} (0.01 단위 41칸 균등 — T19 검수 2차) — 스탯에 곱한다.\n`,
  );

  h(
    '4. 장비 — 티어별 이름과 common 스탯',
    '한손검(장검) 한 벌이다. 다른 계열의 손은 12장 "무기 계열".',
  );
  const tiers = Array.from({ length: 10 }, (_, i) => i + 1);
  const swordSet = styleLines('sword');
  out.push(
    table(
      ['티어', '지역', '착용 Lv', ...swordSet.map((l) => GEAR_LINE_LABELS[l]), '풀세트 값'],
      tiers.map((t) => {
        const set = swordSet.map((l) => gridItem(t, l, 'common'));
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
        '장검 ATK',
        '투구 HP',
        '갑옷 DEF',
        '하의 HP/DEF',
        '장갑 STR/HP',
        '신발 AGI',
        '장신구 LUK',
      ],
      tiers.map((t) => {
        const g = (l: GearLine) => gridItem(t, l, 'common');
        return [
          t,
          g('longsword').atk,
          g('helm').maxHp,
          g('armor').def,
          `${g('pants').maxHp}/${g('pants').def}`,
          `${g('gloves').str}/${g('gloves').maxHp}`,
          g('boots').agi,
          g('accessory').luk,
        ];
      }),
    ),
  );

  h(
    '5. 강화',
    '실패해도 단계는 안 떨어지고 골드만 나갑니다. +6부터 소재는 성공할 때만 씁니다. 반지도 같은 표입니다.',
  );
  const price = gridItem(10, 'longsword', 'common').price;
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
  const dayOf = (r: (typeof REGIONS)[number]) =>
    regionDays(log, r.levelRange[0], r.id === REGIONS.length ? 51 : r.levelRange[1]);
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
        const d = dayOf(r);
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

  // 하루 장비 드랍 (T19 검수 2차 — "하루 전설 기대 획득량") — 처치/일 × 처치당 드랍 × 등급 비율
  out.push(
    '\n**하루 장비 드랍** — 처치/일 × 처치당 드랍(행운 균등) × 등급 비율. ' +
      `기본 → 몬스터 도감 10마리(×${DEX.dropMult}) → 그 지역 보스 카드 2번(드랍 ×${DEX.bossDropMult}) · ` +
      `5번(전설 비율 ×${DEX.bossLegendMult}). 걸음 목표 3만 보 · 보스 첫 처치 장비는 빼고\n`,
  );
  // 세 단계 — 기본, 몬스터 10마리, 보스 2 · 5번까지
  const dropSteps = [1, DEX.dropMult, DEX.dropMult * DEX.bossDropMult];
  const legendShare = [
    DROP_RARITY.legendary!,
    DROP_RARITY.legendary!,
    withLegendary(DROP_RARITY, DEX.bossLegendMult).legendary!,
  ];
  out.push(
    table(
      ['지역', '드랍/일', '전설/일', '전설 하나까지'],
      REGIONS.map((r) => {
        const d = dayOf(r);
        const perKill = mean(
          r.fields.map((f) => DROP_RATE * referencePlayer(fieldLevel(f), r.id).dropMult),
        );
        const drops = dropSteps.map((m) => d.kills * perKill * m);
        const legend = drops.map((n, i) => n * legendShare[i]);
        return [
          r.id,
          drops.map(n1).join(' → '),
          legend.map((n) => n.toFixed(3)).join(' → '),
          legend.map((n) => `${n0(1 / n)}일`).join(' → '),
        ];
      }),
    ),
  );

  // 보스 재사냥 (T19 검수) — 추억과 도감용이라 다음 지역 사냥보다 WP당 한참 덜 벌어야 한다
  out.push(
    '\n**보스 재사냥** — 재도전 값을 내고 EXP · 골드와 도감 한 단계만(장비 · 해금 없음). WP 1,000당\n',
  );
  out.push(
    table(
      ['보스', '재사냥 EXP · 골드', '다음 지역 사냥 EXP · 골드'],
      REGIONS.map((r) => {
        const boss = bossOf(r.id);
        const k = 1_000 / WP_COST.bossRetry(r.id);
        const next = REGIONS[Math.min(r.id, REGIONS.length - 1)];
        const d = dayOf(next);
        const f = 1_000 / (d.entries * WP_COST.fieldEntry(next.id));
        return [
          `${r.id}. ${boss.name}`,
          `${n0(boss.exp * k)} · ${n0(boss.gold * k)}`,
          `${n0(d.exp * f)} · ${n0(d.gold * f)}${next.id === r.id ? ' (제 지역)' : ''}`,
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

  // ── 걸음 목표 · 출석 · 도감 (T19)
  const reward = (r: DailyReward, region: number) =>
    [
      r.gold && `${n0(rewardGold(r, region))}G`,
      r.potion && `${consumableById(regionPotion(region)).name} ${r.potion}`,
      r.material && `소재 ${r.material}`,
      r.gear && '장비 (희귀 50 · 영웅 30 · 전설 20%)',
    ]
      .filter(Boolean)
      .join(' + ');
  h(
    '11. 걸음 목표 · 출석 · 도감 (T19)',
    '둘 다 [받기]를 눌러야 들어온다. 값은 받는 날 있는 지역 기준. 시뮬은 매일 켜서 1만 보 → 목표 두 칸 + 출석을 받는다.',
  );
  out.push(
    table(
      ['걸음 목표', '지역 1', '지역 5'],
      STEP_GOAL_REWARDS.map((r, i) => [
        `${n0((i + 1) * STEP_GOAL)}보`,
        reward(r, 1),
        reward(r, REGIONS.length),
      ]),
    ),
  );
  out.push('\n');
  out.push(
    table(
      ['출석 (연속)', '지역 1', '지역 5'],
      STREAK_REWARDS.map((r, i) => [`${i + 1}일째`, reward(r, 1), reward(r, REGIONS.length)]),
    ),
  );
  out.push('\n하루라도 빠지면 1일째부터. 7일째 다음 날은 다시 1일째 칸.\n');

  const dexAt = (min: number) =>
    REGIONS.map((r) =>
      n1(
        mean(
          balanced.map(
            (run) => DEX_MONSTERS.get(r.id)!.filter((m) => (run.save.dex[m.id] ?? 0) >= min).length,
          ),
        ),
      ),
    );
  out.push('\n**도감 단계** — 테두리는 장비 등급 색\n');
  out.push(
    table(
      ['처치', '보스', '테두리', '열리는 것'],
      DEX.steps.map((s, i) => [s, DEX.bossSteps[i], RARITY_LABEL[RARITIES[i]], DEX_REVEAL[i]]),
    ),
  );
  out.push(
    `\n사냥터 하나를 다 채우면 스탯 포인트 +${DEX.fieldPoints}, 지역 하나를 다 채우면 네 스탯 +${DEX.regionStat}.\n`,
  );
  out.push(
    '\n**보스 카드** — 잡을 때마다 한 단계, 재사냥으로 채운다. 보상은 보스마다 따로 더한다\n',
  );
  out.push(
    table(
      ['처치', '테두리', '보상'],
      DEX.bossSteps.map((s, i) => [
        s,
        RARITY_LABEL[RARITIES[i]],
        i === 0 ? '(첫 처치 장비 · 다음 지역 해금)' : BOSS_REWARDS[i - 1],
      ]),
    ),
  );
  out.push(
    `\n다섯 다 채우면 EXP · 골드 +${pct(DEX.bossExpGold * REGIONS.length)} · ` +
      `네 스탯 +${DEX.bossStat * REGIONS.length} · 강화 성공률 +${pct(DEX.bossEnhance * REGIONS.length)}p` +
      '(100%에서 멈춘다). 드랍 · 전설 배율은 그 보스 지역 사냥터에만 붙는다.\n',
  );
  const species = [...DEX_MONSTERS.values()].flat();
  out.push('\n**원형 → 100마리 스탯**\n');
  out.push(
    table(
      ['스탯', '종 수'],
      SPENDABLE_STATS.map((k) => [STAT_LABEL[k], species.filter((m) => dexStat(m) === k).length]),
    ),
  );
  const all =
    species.length * DEX.cardStat + REGIONS.length * SPENDABLE_STATS.length * DEX.regionStat;
  out.push(
    `\n다 채우면 1차 스탯 +${all} · 스탯 포인트 +${REGIONS.flatMap((r) => r.fields).length * DEX.fieldPoints}.\n`,
  );
  out.push('\n**Lv50에 닿았을 때 도감** (시뮬 균등, 종 수)\n');
  out.push(
    table(
      ['', ...REGIONS.map((r) => `지역 ${r.id}`)],
      [
        ['종', ...REGIONS.map((r) => DEX_MONSTERS.get(r.id)!.length)],
        ['1마리+', ...dexAt(1)],
        [`${DEX.dropAt}마리+ (드랍 ×${DEX.dropMult})`, ...dexAt(DEX.dropAt)],
        [`${DEX_MAX}마리 (스탯)`, ...dexAt(DEX_MAX)],
      ],
    ),
  );

  styleChapter(out, h);

  writeFileSync(OUT, out.join('\n') + '\n');
  expect(lv50(balanced)).toBeDefined();
}, 600_000);

/** 그 레벨에 갈 수 있는 가장 센 사냥터 — 12장 세기 · 화살이 같이 쓴다 */
function topField(r: Region, level: number) {
  return (
    [...r.fields]
      .filter((f) => fieldLevel(f) <= level)
      .sort((a, b) => fieldLevel(b) - fieldLevel(a))[0] ?? r.fields[0]
  );
}

/**
 * 12장 무기 계열 (T18) — 계열마다 세기가 같은지. **세기는 "한 마리 잡는 동안 잃는 HP"와 보스 승률로 잰다** —
 * 자동 전투라 빨리 잡는 것 자체는 값이 없고, 오래 싸우면 그만큼 더 맞는 게 값이다.
 */
function styleChapter(out: string[], h: (title: string, note?: string) => void) {
  h(
    '12. 무기 계열 (T18)',
    `직업 대신 **오른손 무기가 싸우는 방식을 정한다.** 1점 값은 누구에게나 같다. 기술은 ${SKILL_CYCLE} 쓴다.`,
  );
  out.push(
    table(
      ['계열', '손', '특성', '기술'],
      STYLES.map((st) => {
        const [main, off] = STYLE_HANDS[st];
        const hands = off
          ? `${GEAR_LINE_LABELS[main]} + ${GEAR_LINE_LABELS[off]}`
          : `${GEAR_LINE_LABELS[main]} (${st === 'sword' ? '받쳐 쥠' : '두 손'})`;
        return [
          STYLE_LABEL[st],
          hands,
          STYLE_TRAIT_TEXT[st],
          `${SKILL_LABEL[st]} — ${SKILL_TEXT[st]}`,
        ];
      }),
    ),
  );

  out.push('\n**손 줄 — 티어 10 common** (품질 100% · 강화 0)\n');
  out.push(
    table(
      ['줄', 'ATK', 'HP', 'DEF', '회피', '값'],
      HAND_LINES.map((line) => {
        const e = gridItem(10, line, 'common');
        return [
          GEAR_LINE_LABELS[line],
          e.atk,
          e.maxHp,
          e.def,
          e.eva ? pct(e.eva) : '-',
          `${n0(e.price)}G`,
        ];
      }),
    ),
  );

  // 세기 — 지역마다 들어갈 때 · 중간 · 나갈 때 레벨에서 그 레벨 가장 센 사냥터 한 마리 (물약 없이) / 보스는 지역 끝 · 물약 3개
  const runs = 200;
  const rows: string[][] = [];
  const sums = Object.fromEntries(STYLES.map((st) => [st, { loss: 0, boss: 0 }]));
  for (const r of REGIONS) {
    const [lo, hi] = r.levelRange;
    const row = [`${r.id}`];
    let swordLoss = 0;
    let swordBoss = 0;
    for (const st of STYLES) {
      let lost = 0;
      let fights = 0;
      for (const level of [lo, Math.round((lo + hi) / 2), hi]) {
        const pool = monstersOfField(topField(r, level));
        const stats = statsOf(baselineSave(level, r.id, st));
        const player: Combatant = { name: '', hp: stats.maxHp, ...stats };
        const rng = makeRng(11);
        for (let i = 0; i < runs * 2; i++) {
          const m = pool[i % pool.length];
          lost +=
            (stats.maxHp - simulateBattle(player, { ...m, hp: m.maxHp }, rng).playerHp) /
            stats.maxHp;
          fights += 1;
        }
      }
      let wins = 0;
      const rng = makeRng(7);
      for (let i = 0; i < runs; i++) if (bossTrial(hi, r.id, rng, undefined, st) === 'win') wins++;
      const loss = lost / fights;
      const boss = wins / runs;
      if (st === 'sword') {
        swordLoss = loss;
        swordBoss = boss;
      }
      sums[st].loss += loss / swordLoss / REGIONS.length;
      sums[st].boss += (boss - swordBoss) / REGIONS.length;
      row.push(
        st === 'sword'
          ? `${pct(loss, 1)} · ${pct(boss)}`
          : `×${(loss / swordLoss).toFixed(2)} · ${pct(boss)}`,
      );
    }
    rows.push(row);
  }
  rows.push([
    '평균',
    ...STYLES.map((st) =>
      st === 'sword'
        ? '×1.00 · —'
        : `×${sums[st].loss.toFixed(2)} · ${sums[st].boss >= 0 ? '+' : ''}${(sums[st].boss * 100).toFixed(0)}%p`,
    ),
  ]);
  out.push(
    '\n**세기** — 한 마리 잡는 동안 잃는 HP(한손검 대비, 작을수록 세다) · 보스 승률. 사냥터는 지역의 들어갈 때 · 중간 · 나갈 때 레벨, ' +
      '물약 없이 한 마리씩. 보스는 지역 끝 레벨 · 보통 투자 한 벌 · 물약 3개 (벤치 200번)\n',
  );
  out.push(table(['지역', ...STYLES.map((st) => STYLE_LABEL[st])], rows));

  // 시뮬 — 첫날 상점에서 그 계열 무기로 갈아 든다. 활은 지역 일반 화살을 300발씩 채운다
  const sims = STYLES.map((st) => ({
    st,
    runs: SEEDS.map((seed) =>
      simulate({ steps: STEPS, build: BUILDS[0], ...CAP, style: st }, seed),
    ),
  }));
  out.push(
    `\n**시뮬** (균등 · 하루 1만 보 · 시드 ${SEEDS.length}개) — 유지비 = (물약 + 여관 + 화살) ÷ 번 골드\n`,
  );
  out.push(
    table(
      ['계열', 'Lv50', '유지비', '그중 화살'],
      sims.map(({ st, runs: rs }) => {
        const days = rs.map((r) => dayAtLevel(r.log, 50));
        const sum = (pick: (d: DayLog) => number) =>
          rs.reduce((a, r) => a + r.log.reduce((b, d) => b + pick(d), 0), 0);
        const gold = sum((d) => d.gold);
        return [
          STYLE_LABEL[st],
          days.some((d) => d === undefined) ? '-' : `${n1(mean(days as number[]))}일`,
          pct(sum((d) => d.potionCost + d.innCost + d.arrowCost) / gold),
          st === 'bow' ? pct(sum((d) => d.arrowCost) / gold, 1) : '-',
        ];
      }),
    ),
  );

  // 배분 — 계열이 스탯 가중치를 만들지 않는지 (정해진 것 2번). 힘 쪽이 조금 센 건 T17_7 검수 5차 그대로다
  const picks = ['균등', '힘 편중', '힘 몰빵', '민첩 몰빵', '체력 몰빵', '행운 몰빵'];
  const chosen = BUILDS.filter((b) => picks.includes(b.name));
  out.push(
    '\n**배분별 세기** — Lv50 · 지역 5 보스를 버프 없이 30% 이기는 보스 세기 (균등 = 1.00). ' +
      '**어느 계열이든 순서가 같다** — 계열이 스탯 가중치를 만들지 않는다\n',
  );
  out.push(
    table(
      ['계열', ...chosen.map((b) => b.name)],
      STYLES.map((st) => [
        STYLE_LABEL[st],
        ...buildPower(50, 5, 120, st, chosen).map((f) => f.toFixed(2)),
      ]),
    ),
  );

  // 한 발 대미지와 한 마리에 잃는 HP는 전투를 실제로 돌려 잰다 — 빗나간 발(0)까지 넣은 평균이라
  // 명중 · 회피 · 치명 · 방어가 다 들어 있고, 폭탄 · 얼음 · 번개 · 흡혈처럼 대미지가 아닌 효과는 잃는 HP에 나온다 (T18_1)
  const shot = (player: Combatant, pool: Monster[]) => {
    const rng = makeRng(5);
    const values: number[] = [];
    let lost = 0;
    const fights = 200;
    for (let i = 0; i < fights; i++) {
      const m = pool[i % pool.length];
      const r = simulateBattle(player, { ...m, hp: m.maxHp }, rng);
      for (const e of r.events) if (e.actor === 'player') values.push(e.value);
      lost += (player.maxHp - r.playerHp) / player.maxHp / fights;
    }
    return { dmg: mean(values), lost };
  };
  const worth: Record<string, number[]> = {};
  const arrowRows = REGIONS.flatMap((r) => {
    const level = Math.round((r.levelRange[0] + r.levelRange[1]) / 2);
    const pool = monstersOfField(topField(r, level));
    const stats = statsOf(baselineSave(level, r.id, 'bow'));
    const bow: Combatant = { name: '', hp: stats.maxHp, ...stats, arrows: 1e6 };
    const arrows = ARROWS.filter((a) => a.region === r.id);
    const basic = shot({ ...bow, arrow: arrows.find((a) => a.effect === 'basic')! }, pool);
    const none = shot({ ...bow, arrows: 0 }, pool);
    const row = (name: string, effect: string, atk: string, got: typeof basic, where: string) => [
      r.id,
      name,
      effect,
      atk,
      n1(got.dmg),
      pct(got.dmg / basic.dmg),
      got.lost > 0 ? `×${(basic.lost / got.lost).toFixed(2)}` : '-',
      where,
    ];
    return [
      row('화살 없음', `활로 친다(${pct(STYLE_TRAIT.bow.noArrow)})`, '-', none, '-'),
      ...arrows.map((a) => {
        const got = shot({ ...bow, arrow: a }, pool);
        if (a.effect !== 'basic') (worth[a.effect] ??= []).push(basic.lost / got.lost);
        const where =
          a.effect === 'basic'
            ? `상점 ${n0(a.price)}G (1발 ${n1(a.price / ARROW.bundle)}G)`
            : '드랍';
        return row(a.name, ARROW_EFFECT_TEXT[a.effect], `+${a.atk}`, got, where);
      }),
    ];
  });
  out.push(
    `\n**화살** (T18 → T18_1) — **상점은 기본 화살만** ${ARROW.bundle}발씩 판다. 쏠 때마다 1발, 없으면 활로 친다(${pct(STYLE_TRAIT.bow.noArrow)}). ` +
      `**특수 화살 ${SPECIAL_ARROWS.length}종은 어느 몬스터든** 처치마다 ${pct(ARROW_DROP.rate)} × 장비와 같은 드랍 배율로 ${ARROW_DROP.bundle}발 — ` +
      '종류는 고르게, 티어는 그 지역이다. 계열을 가리지 않고 줍는다. ' +
      '**한 발** = 지역 가운데 레벨 · 보통 투자 활 한 벌 · 그 레벨 가장 센 사냥터 몬스터에게 쏜 한 발의 평균 대미지(빗나감 포함). ' +
      '**값어치** = 한 마리 잡는 동안 잃는 HP가 기본 화살의 몇 분의 1인가(×1.25면 20% 덜 잃는다). 특수 화살의 목표는 ×1.2~1.4다. 시뮬은 기본 화살만 쓴다\n',
  );
  out.push(
    table(
      ['효과', '값어치 (지역 1 · 2 · 3 · 4 · 5)', '평균'],
      SPECIAL_ARROWS.map((e) => [
        ARROW_NAMES[e],
        worth[e].map((v) => `×${v.toFixed(2)}`).join(' · '),
        `×${mean(worth[e]).toFixed(2)}`,
      ]),
    ),
  );
  out.push('');
  out.push(
    table(['지역', '이름', '효과', 'ATK', '한 발', '기본 대비', '값어치', '구하는 곳'], arrowRows),
  );
}
