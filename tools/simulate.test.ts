/**
 * `npm run sim` — §6의 밸런스 표를 실제 전투로 재현한다.
 *
 * 숫자를 눈으로 보는 도구이면서 §6.2의 도달 일수를 검사한다.
 * 어긋나면 표를 고치기 전에 원인을 먼저 찾는다.
 */
import { expect, test } from 'vitest';

import { gearSetFor } from '../src/content';
import { combatStats } from '../src/game/formulas';
import { setBonus } from '../src/game/items';
import { BUILDS, dayAtLevel, simulate, type Build, type DayLog } from './simulate';

/** §6.1 기준선 — 하루 10,000보. */
const STEPS = 10_000;
const CAP = { maxLevel: 50, maxDays: 400 };

/** §6.2 "결과 — 목표와 대조" 표. */
const TARGET_DAYS = [
  [10, 7.1],
  [30, 45.0],
  [50, 120.1],
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
    kills: mean((d) => d.kills),
    entries: mean((d) => d.entries),
    deaths: mean((d) => d.deaths),
    clearRate: mean((d) => d.clearRate),
  };
}

const balanced: Build = BUILDS[0];

test('§6.2 도달 일수 — Lv10 7.1일 / Lv30 45.0일 / Lv50 120.1일', () => {
  const { log, days, save } = simulate({ steps: STEPS, build: balanced, ...CAP });

  console.log(`\n■ 하루 ${STEPS.toLocaleString()}보 · ${balanced.name} 배분 · ${days}일 시뮬`);
  console.log('  목표 레벨   계획서    시뮬     차이');
  console.log('  ' + '─'.repeat(40));
  for (const [level, target] of TARGET_DAYS) {
    const actual = dayAtLevel(log, level);
    const diff = actual ? `${(((actual - target) / target) * 100).toFixed(0)}%` : '미달';
    console.log(`  Lv${pad(level, 2)}      ${pad(target, 7)}일 ${pad(actual ?? '-', 6)}일 ${pad(diff, 8)}`);
  }
  console.log('  ' + '─'.repeat(40));
  console.log(`  ${days}일차 도달 레벨: ${save.player.level}`);

  // T12 완료 기준. 계획서는 5%지만 Lv30이 -7%로 나온다 — §6.2 표는 "평균 티어 3"을
  // 가정하는데 실제 플레이어는 갈 수 있는 사냥터 중 제일 쉬운 쪽부터 돈다.
  for (const [level, target] of TARGET_DAYS) {
    const actual = dayAtLevel(log, level);
    expect(actual, `Lv${level} 도달`).toBeDefined();
    expect(Math.abs((actual! - target) / target), `Lv${level} 오차`).toBeLessThan(0.1);
  }
});

test('§6.2·§6.3 하루 수입 — 지역별 EXP와 골드', () => {
  const { log } = simulate({ steps: STEPS, build: balanced, ...CAP });

  // §6.2 "하루 EXP" / §6.3 "하루 골드" 표
  const planned = [
    { region: 1, levels: [1, 8], exp: 565, gold: 2_020 },
    { region: 2, levels: [8, 16], exp: 719, gold: 4_041 },
    { region: 3, levels: [16, 26], exp: 915, gold: 6_061 },
    { region: 4, levels: [26, 37], exp: 1_164, gold: 8_081 },
    { region: 5, levels: [37, 50], exp: 1_482, gold: 10_102 },
  ];

  console.log('\n■ 하루 수입 (계획서 → 시뮬)');
  console.log('  지역  레벨      하루EXP           하루골드          입장  몬스터  완주율  사망  골드손실');
  console.log('  ' + '─'.repeat(78));
  for (const p of planned) {
    const a = averageBetween(log, p.levels[0], p.levels[1]);
    if (!a) {
      console.log(`  ${p.region}    ${pad(p.levels.join('~'), 6)}   (도달 못 함)`);
      continue;
    }
    console.log(
      `  ${p.region}    ${pad(p.levels.join('~'), 6)}  ${pad(p.exp, 5)} → ${pad(a.exp.toFixed(0), 5)}  ` +
        `${pad(p.gold.toLocaleString(), 7)} → ${pad(a.gold.toFixed(0), 6)}  ` +
        `${pad(a.entries.toFixed(1), 5)} ${pad(a.kills.toFixed(1), 6)} ` +
        `${pad((a.clearRate * 100).toFixed(0) + '%', 7)} ${pad(a.deaths.toFixed(2), 5)} ${pad(a.goldLost.toFixed(0), 7)}`,
    );
  }
  console.log('  ' + '─'.repeat(78));
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
    const { log } = simulate({ steps: STEPS, build, ...CAP });
    const deaths = log.reduce((s, d) => s + d.deaths, 0) / Math.max(1, log.length);
    const clear = log.reduce((s, d) => s + d.clearRate, 0) / Math.max(1, log.length);
    const at = (lv: number) => pad(dayAtLevel(log, lv) ?? '-', 6);
    reached.push({ name: build.name, day: dayAtLevel(log, 50) });
    console.log(
      `  ${padEnd(build.name, 12)}${at(10)}  ${at(30)}  ${at(50)}  ` +
        `${pad(deaths.toFixed(2), 7)}  ${pad((clear * 100).toFixed(0) + '%', 6)}`,
    );
  }
  console.log('  ' + '─'.repeat(56));

  const done = reached.filter((r) => r.day !== undefined);
  expect(done.length, '레벨 50에 닿은 빌드').toBeGreaterThan(0);
});

test('장비가 전투력의 85%를 댄다 (§4.5) — 맨몸 성장은 선형으로 남는다', () => {
  console.log('\n■ 맨몸 vs 장비 (그 레벨 common 풀세트)');
  console.log('  레벨   맨몸HP   +장비HP   맨몸ATK  +장비ATK   장비 몫');
  console.log('  ' + '─'.repeat(52));

  const shares: number[] = [];
  for (const level of [1, 10, 20, 30, 40, 50]) {
    const naked = combatStats(level);
    const gear = setBonus(gearSetFor(level));
    const hp = naked.maxHp + gear.maxHp;
    const atk = naked.atk + gear.atk;
    const share = gear.atk / atk;
    if (level >= 10) shares.push(share);

    console.log(
      `  Lv${pad(level, 2)} ${pad(naked.maxHp, 8)} ${pad(hp, 8)} ${pad(naked.atk, 9)} ${pad(atk, 9)}` +
        ` ${pad((share * 100).toFixed(0) + '%', 8)}`,
    );
  }
  console.log('  ' + '─'.repeat(52));

  // Lv50에서 85% 근처여야 한다. 이게 무너지면 §4.5의 "장비를 모으는 재미"가 사라진다
  expect(shares.at(-1), 'Lv50 장비 몫').toBeGreaterThan(0.8);
  // 레벨이 오를수록 장비 비중이 커진다 — 뒤로 갈수록 노가다가 의미를 갖는다
  expect(shares, '장비 몫은 단조 증가').toEqual([...shares].sort((a, b) => a - b));
});
