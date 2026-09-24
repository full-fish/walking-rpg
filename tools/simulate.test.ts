/**
 * `npm run sim` — §6의 밸런스 표를 실제 전투로 재현한다.
 *
 * 숫자를 눈으로 보는 도구이면서 §6.2의 도달 일수를 검사한다.
 * 어긋나면 표를 고치기 전에 원인을 먼저 찾는다.
 */
import { expect, test } from 'vitest';

import { gearSetFor } from '../src/content';
import { combatStats, evenSpend } from '../src/game/formulas';
import { setBonus } from '../src/game/items';
import { BUILDS, dayAtLevel, simulate, type Build, type DayLog } from './simulate';

/** §6.1 기준선 — 하루 10,000보. */
const STEPS = 10_000;
const CAP = { maxLevel: 50, maxDays: 400 };

/**
 * 시드 5개를 돌려 평균을 본다.
 *
 * 한 판의 마릿수·크리·회피가 전부 난수라 시드 하나로는 도달 일수가 ±1일 흔들린다.
 * 그 폭이 §6.2 목표의 15%라, 시드 하나로 밸런스를 잡으면 노이즈를 쫓게 된다.
 */
const SEEDS = [1, 2, 3, 4, 5];

function runAll(build: Build) {
  return SEEDS.map((seed) => simulate({ steps: STEPS, build, ...CAP }, seed));
}

/** 그 레벨에 도달한 평균 일수. 한 시드라도 못 찍으면 undefined. */
function meanDay(runs: ReturnType<typeof runAll>, level: number): number | undefined {
  const days = runs.map((r) => dayAtLevel(r.log, level));
  if (days.some((d) => d === undefined)) return undefined;
  return (days as number[]).reduce((sum, d) => sum + d, 0) / days.length;
}

/**
 * §6.2 "결과 — 목표와 대조" 표와 허용 오차.
 *
 * **§6.2는 자기 안에서 안 맞는다.** 같은 절의 "하루 EXP" 표를 expToNext에 그대로 넣으면
 * Lv10 4.9일 / Lv30 37.8일 / Lv50 109.2일이 나온다 — 적어둔 목표(7.1 / 45 / 120.1)보다
 * 10~45% 빠르다. 초반일수록 어긋나는데, 레벨 1~9를 다 올리는 데 2,990 EXP뿐이라
 * 하루 480 EXP면 6일에 끝나기 때문이다.
 *
 * 그래서 **뒤로 갈수록 좁게** 본다. Lv50이 진짜 목표고(§6.1 "3~4개월"),
 * Lv10은 표 자체가 흔들리는 구간이라 넓게 둔다. 표를 고치는 건 기획 결정이라 안 한다.
 */
const TARGET_DAYS = [
  [10, 7.1, 0.25],
  [30, 45.0, 0.15],
  [50, 120.1, 0.1],
] as const;

const pad = (v: string | number, w: number) => String(v).padStart(w);
const padEnd = (v: string, w: number) => v.padEnd(w);

/** 그 레벨 구간을 도는 동안의 하루 평균. */
function averageBetween(log: DayLog[], from: number, to: number) {
  const rows = log.filter((d) => d.level >= from && d.level < to);
  if (rows.length === 0) return null;
  const mean = (pick: (d: DayLog) => number) => rows.reduce((s, d) => s + pick(d), 0) / rows.length;
  return {
    exp: mean((d) => d.exp),
    gold: mean((d) => d.gold),
    goldLost: mean((d) => d.goldLost),
    potionCost: mean((d) => d.potionCost),
    innCost: mean((d) => d.innCost),
    kills: mean((d) => d.kills),
    entries: mean((d) => d.entries),
    deaths: mean((d) => d.deaths),
    clearRate: mean((d) => d.clearRate),
  };
}

const balanced: Build = BUILDS[0];

test('§6.2 도달 일수 — Lv10 7.1일 / Lv30 45.0일 / Lv50 120.1일', () => {
  const runs = runAll(balanced);

  console.log(
    `\n■ 하루 ${STEPS.toLocaleString()}보 · ${balanced.name} 배분 · 시드 ${SEEDS.length}개 평균`,
  );
  console.log('  목표 레벨   계획서    시뮬     차이           시드별');
  console.log('  ' + '─'.repeat(58));
  for (const [level, target, tolerance] of TARGET_DAYS) {
    const actual = meanDay(runs, level);
    const diff = actual ? `${(((actual - target) / target) * 100).toFixed(0)}%` : '미달';
    const each = runs.map((r) => dayAtLevel(r.log, level) ?? '-').join(' ');
    console.log(
      `  Lv${pad(level, 2)}      ${pad(target, 7)}일 ${pad(actual?.toFixed(1) ?? '-', 6)}일 ` +
        `${pad(diff, 6)} (±${tolerance * 100}%)  ${each}`,
    );
  }
  console.log('  ' + '─'.repeat(58));
  console.log(`  마지막 날 도달 레벨: ${runs.map((r) => r.save.player.level).join(' ')}`);

  for (const [level, target, tolerance] of TARGET_DAYS) {
    const actual = meanDay(runs, level);
    expect(actual, `Lv${level} 도달`).toBeDefined();
    expect(Math.abs((actual! - target) / target), `Lv${level} 오차`).toBeLessThan(tolerance);
  }
});

test('§6.2·§6.3 하루 수입 — 지역별 EXP와 골드', () => {
  const log = runAll(balanced).flatMap((r) => r.log);

  // §6.2 "하루 EXP" / §6.3 "하루 골드" 표
  const planned = [
    { region: 1, levels: [1, 8], exp: 565, gold: 2_020 },
    { region: 2, levels: [8, 16], exp: 719, gold: 4_041 },
    { region: 3, levels: [16, 26], exp: 915, gold: 6_061 },
    { region: 4, levels: [26, 37], exp: 1_164, gold: 8_081 },
    { region: 5, levels: [37, 50], exp: 1_482, gold: 10_102 },
  ];

  console.log('\n■ 하루 수입 (계획서 → 시뮬)');
  console.log(
    '  지역  레벨      하루EXP           하루골드          입장  몬스터  완주율  사망  물약   여관   유지비',
  );
  console.log('  ' + '─'.repeat(90));
  for (const p of planned) {
    const a = averageBetween(log, p.levels[0], p.levels[1]);
    if (!a) {
      console.log(`  ${p.region}    ${pad(p.levels.join('~'), 6)}   (도달 못 함)`);
      continue;
    }
    // 유지비 = 물약 + 여관. §4.5가 수입의 25~35%를 목표로 잡은 값이다
    const upkeep = (a.potionCost + a.innCost) / Math.max(1, a.gold);
    console.log(
      `  ${p.region}    ${pad(p.levels.join('~'), 6)}  ${pad(p.exp, 5)} → ${pad(a.exp.toFixed(0), 5)}  ` +
        `${pad(p.gold.toLocaleString(), 7)} → ${pad(a.gold.toFixed(0), 6)}  ` +
        `${pad(a.entries.toFixed(1), 5)} ${pad(a.kills.toFixed(1), 6)} ` +
        `${pad((a.clearRate * 100).toFixed(0) + '%', 7)} ${pad(a.deaths.toFixed(2), 5)} ` +
        `${pad(a.potionCost.toFixed(0), 6)} ${pad(a.innCost.toFixed(0), 6)} ${pad((upkeep * 100).toFixed(0) + '%', 6)}`,
    );
  }
  console.log('  ' + '─'.repeat(90));
});

test('★ 골드는 어디로 가나 — 유지비가 수입의 25~35%여야 한다 (§4.5)', () => {
  // 두 플레이어를 나란히 본다 (T17_6). 기준선은 강화를 안 하고, 투자형은 남는 걸 전부 강화에 넣는다.
  // 실제 플레이어는 둘 사이 어딘가다. 몬스터를 "보통으로 투자한 사람"에 맞춘 뒤로(T17_6 검수)
  // 유지비 목표는 투자형에서 잰다 — 전에는 투자형이 2%라 물약·여관이 사실상 안 쓰였다
  const flows = [false, true].map((invest) => {
    const runs = [1, 2, 3].map((seed) =>
      simulate({ steps: STEPS, build: balanced, ...CAP, invest }, seed),
    );
    const avg = (pick: (r: (typeof runs)[number]) => number) =>
      runs.reduce((sum, r) => sum + pick(r), 0) / runs.length;
    const earned = avg((r) => r.log.reduce((sum, d) => sum + d.gold, 0));
    const kept = avg((r) => Object.values(r.save.materials).reduce((a, n) => a + n, 0));
    const enhanced = avg((r) => r.materialsUsed.enhance);
    const boss = avg((r) => r.materialsUsed.boss);
    // Lv50에 낀 장비의 강화 단계 — +6부터는 소재가 있어야 올라간다 (T17_6 검수)
    const worn = runs[0].save.inventory
      .filter((i) => Object.values(runs[0].save.equipped).includes(i.uid))
      .map((i) => i.enhance)
      .sort((a, b) => b - a);
    return {
      earned,
      materials: { gained: kept + enhanced + boss, enhanced, boss, kept },
      worn,
      days: avg((r) => r.days),
      rows: [
        ['번 골드 (사냥)', earned],
        ['장비 판매 (드랍 · 옛 장비)', avg((r) => r.soldGear)],
        ['물약', -avg((r) => r.spentOnPotions)],
        ['여관', -avg((r) => r.spentOnInn)],
        ['장비 구매', -avg((r) => r.spentOnGear)],
        ['강화', -avg((r) => r.spentOnEnhance)],
        ['사망 손실 (창고 안 씀)', -avg((r) => r.log.reduce((sum, d) => sum + d.goldLost, 0))],
        ['남은 골드', avg((r) => r.save.player.gold)],
      ] as [string, number][],
      upkeep: (avg((r) => r.spentOnPotions) + avg((r) => r.spentOnInn)) / earned,
    };
  });

  console.log(`\n■ Lv50까지 골드 흐름 (시드 3개 평균) — 기준선(강화 안 함) / 투자형(남는 골드 전부 강화)`);
  console.log('  ' + '─'.repeat(64));
  const [base, invest] = flows;
  for (let i = 0; i < base.rows.length; i++) {
    const cell = (f: (typeof flows)[number]) => {
      const v = f.rows[i][1];
      return `${pad(v.toLocaleString(undefined, { maximumFractionDigits: 0 }), 10)} ${pad(((Math.abs(v) / f.earned) * 100).toFixed(0) + '%', 4)}`;
    };
    console.log(`  ${padEnd(base.rows[i][0], 22)} ${cell(base)}   ${cell(invest)}`);
  }
  console.log('  ' + '─'.repeat(64));
  console.log(
    `  유지비(물약+여관) ${(base.upkeep * 100).toFixed(0)}% / ${(invest.upkeep * 100).toFixed(0)}% — 목표 25~35% (투자형)` +
      `   Lv50 ${base.days.toFixed(0)}일 / ${invest.days.toFixed(0)}일`,
  );
  for (const [name, f] of [
    ['기준선', base],
    ['투자형', invest],
  ] as const) {
    const m = f.materials;
    console.log(
      `  소재 (${name}) 모은 ${m.gained.toFixed(0)}개 → 강화 ${m.enhanced.toFixed(0)} · 보스 버프 ${m.boss.toFixed(0)} · 남음 ${m.kept.toFixed(0)}` +
        `   Lv50에 낀 장비 +${f.worn.join(' +')} (시드 1)`,
    );
  }
  expect(invest.upkeep, '유지비 비중 (투자형)').toBeGreaterThan(0.15);
});

test('§6.2 덜 걷는 날 — 걸음 수에 따른 진행 속도', () => {
  console.log('\n■ 하루 걸음별 (균등 배분)');
  console.log('  걸음       입장/일   Lv10    Lv30    Lv50');
  console.log('  ' + '─'.repeat(48));
  for (const steps of [0, 4_000, 10_000, 15_000]) {
    const { log } = simulate({ steps, build: balanced, ...CAP });
    const entries = log.reduce((s, d) => s + d.entries, 0) / Math.max(1, log.length);
    const at = (lv: number) => pad(dayAtLevel(log, lv) ?? '-', 6);
    console.log(
      `  ${pad(steps.toLocaleString(), 7)}보  ${pad(entries.toFixed(1), 7)}  ` +
        `${at(10)}  ${at(30)}  ${at(50)}`,
    );
  }
  console.log('  ' + '─'.repeat(48));
});

test('빌드별 편차 — 배분을 어떻게 하든 굴러가야 한다 (§4.3)', () => {
  console.log('\n■ 빌드별 (하루 10,000보)');
  console.log('  빌드          Lv10    Lv30    Lv50   사망/일   완주율');
  console.log('  ' + '─'.repeat(56));

  const reached: { name: string; day: number | undefined }[] = [];
  for (const build of BUILDS) {
    const runs = runAll(build);
    const log = runs.flatMap((r) => r.log);
    const deaths = log.reduce((s, d) => s + d.deaths, 0) / Math.max(1, log.length);
    const clear = log.reduce((s, d) => s + d.clearRate, 0) / Math.max(1, log.length);
    const stuckAt = runs.reduce((sum, r) => sum + r.save.player.level, 0) / runs.length;
    const at = (lv: number) =>
      pad(meanDay(runs, lv)?.toFixed(0) ?? `Lv${stuckAt.toFixed(0)}`, 6);
    reached.push({ name: build.name, day: meanDay(runs, 50) });
    console.log(
      `  ${padEnd(build.name, 12)}${at(10)}  ${at(30)}  ${at(50)}  ` +
        `${pad(deaths.toFixed(2), 7)}  ${pad((clear * 100).toFixed(0) + '%', 6)}`,
    );
  }
  console.log('  ' + '─'.repeat(56));

  // §4.3 "배분을 어떻게 하든 굴러가야 한다" — 하나도 빠짐없이 Lv50에 닿아야 한다.
  // T13까지는 행운 몰빵이 400일 안에 못 끝냈다.
  const stuck = reached.filter((r) => r.day === undefined).map((r) => r.name);
  expect(stuck, 'Lv50에 못 간 빌드').toEqual([]);
  // **네 스탯 균등 배분이 제일 빠르다** (T17_7 검수) — 평균 넘는 몫은 절반만 들고(effectiveSpend)
  // 장비 몫에도 %로 붙어서다(STAT_PER_POINT gear*). 이게 깨지면 1점의 값이 스탯끼리 두 배 넘게 벌어진 것이다
  const fastest = reached.reduce((a, b) => (a.day! <= b.day! ? a : b));
  expect(fastest.name, '제일 빠른 빌드').toBe(balanced.name);
  // 빌드 13개 × 시드 — 기본 5초를 넘는다
}, 30_000);

test('장비가 전투력의 85%를 댄다 (§4.5) — 맨몸 성장은 선형으로 남는다', () => {
  console.log('\n■ 맨몸 vs 장비 (균등 배분 · 그 레벨 common 풀세트)');
  console.log('  레벨   맨몸HP   +장비HP   맨몸ATK  +장비ATK   장비 몫');
  console.log('  ' + '─'.repeat(52));

  const shares: number[] = [];
  for (const level of [1, 10, 20, 30, 40, 50]) {
    // 장비 몫은 1차 스탯만큼 %로 커진다 (T17_7 검수) — 기준 플레이어(균등 배분)로 잰다
    const naked = combatStats(level, 'warrior', evenSpend(level));
    const geared = combatStats(level, 'warrior', evenSpend(level), setBonus(gearSetFor(level)));
    const hp = geared.maxHp;
    const atk = geared.atk;
    const share = (geared.atk - naked.atk) / atk;
    if (level >= 10) shares.push(share);

    console.log(
      `  Lv${pad(level, 2)} ${pad(naked.maxHp, 8)} ${pad(hp, 8)} ${pad(naked.atk.toFixed(0), 9)} ${pad(atk.toFixed(0), 9)}` +
        ` ${pad((share * 100).toFixed(0) + '%', 8)}`,
    );
  }
  console.log('  ' + '─'.repeat(52));

  // Lv50에서 85% 근처여야 한다. 이게 무너지면 §4.5의 "장비를 모으는 재미"가 사라진다
  expect(shares.at(-1), 'Lv50 장비 몫').toBeGreaterThan(0.8);
  // 레벨이 오를수록 장비 비중이 커진다 — 뒤로 갈수록 노가다가 의미를 갖는다
  expect(shares, '장비 몫은 단조 증가').toEqual([...shares].sort((a, b) => a - b));
});
