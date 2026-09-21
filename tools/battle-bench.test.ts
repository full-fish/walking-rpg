/**
 * 전투 엔진 벤치마크 — 조합마다 1,000회를 돌려 승률·행동 수·완주율을 출력한다.
 *
 *   npm run bench
 *
 * T11부터는 **실제 사냥터 풀**을 잰다. 한 판은 그 사냥터의 몬스터 중에서 무작위로 나오므로
 * (§4.4) 풀 평균이 곧 체감이다. 티어를 레벨과 같다고 놓던 T7 방식은 실제와 달랐다.
 * `npm test`는 --dir src라 이 파일을 돌리지 않는다. 진짜 시뮬레이터는 T12.
 */
import { expect, test } from 'vitest';

import { gearSetFor, monstersOfField, REGIONS, type Field, type Region } from '../src/content';
import { makeRng, simulateBattle, type Combatant } from '../src/game/battle';
import { combatStats } from '../src/game/formulas';
import { setBonus } from '../src/game/items';

const RUNS = 1_000;
/** §4.2 목표 행동 수 */
const TARGET = { min: 20, max: 40 };
/** 한 판의 마릿수. §4.4 삼각분포의 평균(4)과 최대(6) — 이 둘의 차이가 곧 도박이다. */
const RUN_SIZES = [4, 6] as const;

/**
 * Lv L 전사, **그 레벨 common 풀세트 착용** (§4.5).
 *
 * 맨몸으로 재면 후반이 전멸한다 — 전투력의 85%가 장비에서 오는 게 설계라서다.
 * 기준선은 "그 지역에서 살 수 있는 common 한 벌"이고, 등급·품질·강화는 전부 그 위의 이득이다.
 * 스탯 계산은 화면과 같은 combatStats·setBonus를 쓴다 — 여기서 따로 세면 둘이 어긋난다.
 */
function warrior(level: number): Combatant {
  const stats = combatStats(level);
  const gear = setBonus(gearSetFor(level));
  const geared = {
    ...stats,
    maxHp: stats.maxHp + gear.maxHp,
    atk: stats.atk + gear.atk,
    def: stats.def + gear.def,
  };
  return { name: `Lv${level} 전사`, hp: geared.maxHp, ...geared };
}

function poolOf(field: Field): Combatant[] {
  return monstersOfField(field).map((m) => ({ ...m, hp: m.maxHp }));
}

/** 지역을 도는 동안의 레벨 세 지점 — 들어갈 때, 중간, 나갈 때. */
function levelsOf(region: Region): number[] {
  const [lo, hi] = region.levelRange;
  return [lo, Math.round((lo + hi) / 2), hi];
}

/**
 * 그 사냥터를 돌 만한 레벨 (§7.2⑤).
 *
 * 지역 안의 난이도 변화는 **사냥터를 옮겨 다니는 것**에서 온다 — 같은 사냥터를 계속 돌면
 * 몬스터는 그대로인데 플레이어만 크므로 당연히 쉬워진다. 그러니 사냥터마다
 * "풀 평균 티어가 대역에서 어디쯤인가"로 적정 레벨을 잡고, 거기서 §4.2·§4.4를 검사한다.
 */
function properLevel(region: Region, field: Field): number {
  const avgTier = field.pool.reduce((sum, [, t]) => sum + t, 0) / field.pool.length;
  const [loT, hiT] = region.tierBand;
  const [loL, hiL] = region.levelRange;
  return Math.round(loL + ((avgTier - loT) / (hiT - loT)) * (hiL - loL));
}

/** 풀 전체의 평균. 사냥터는 풀에서 무작위로 뽑으므로 평균이 체감에 가깝다. */
function averageOf<T extends Record<string, number>>(rows: T[]): T {
  const keys = Object.keys(rows[0]) as (keyof T)[];
  return Object.fromEntries(
    keys.map((k) => [k, rows.reduce((sum, r) => sum + r[k], 0) / rows.length]),
  ) as T;
}

function runPairing(player: Combatant, monster: Combatant) {
  let wins = 0;
  let hardcaps = 0;
  let totalActions = 0;
  let minActions = Infinity;
  let maxActions = 0;
  let hpLeftRatio = 0;

  for (let seed = 0; seed < RUNS; seed++) {
    const r = simulateBattle(player, monster, makeRng(seed));
    const n = r.events.length;
    totalActions += n;
    minActions = Math.min(minActions, n);
    maxActions = Math.max(maxActions, n);
    if (r.outcome === 'win') {
      wins++;
      hpLeftRatio += r.playerHp / player.maxHp;
    }
    if (r.outcome === 'flee') hardcaps++;
  }

  return {
    winRate: wins / RUNS,
    avgActions: totalActions / RUNS,
    minActions,
    maxActions,
    hardcapRate: hardcaps / RUNS,
    // 이긴 판에서만 평균 — 진 판은 항상 0이라 섞으면 의미가 없다
    avgHpLeft: wins > 0 ? hpLeftRatio / wins : 0,
  };
}

/**
 * count마리 연속을 돌린다. HP는 전투 사이에 이어지고 회복은 없다 (§4.2).
 * 물약을 하나도 안 쓴 최악의 경우다.
 */
function runStreak(player: Combatant, monster: Combatant, count: number) {
  let cleared = 0;
  let hpLeftRatio = 0;
  let killsTotal = 0;

  for (let seed = 0; seed < RUNS; seed++) {
    const rng = makeRng(seed);
    let hp = player.maxHp;
    let kills = 0;
    for (let i = 0; i < count; i++) {
      const r = simulateBattle({ ...player, hp }, monster, rng);
      if (r.outcome !== 'win') break;
      hp = r.playerHp;
      kills++;
    }
    killsTotal += kills;
    if (kills === count) {
      cleared++;
      hpLeftRatio += hp / player.maxHp;
    }
  }

  return {
    clearRate: cleared / RUNS,
    avgKills: killsTotal / RUNS,
    avgHpLeft: cleared > 0 ? hpLeftRatio / cleared : 0,
  };
}

const pad = (v: string | number, width: number) => String(v).padStart(width);
const padEnd = (v: string, width: number) => v.padEnd(width);
const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

test(`1:1 전투 — 하드캡 0%, 사냥터별 ${TARGET.min}~${TARGET.max}행동 진단 (§4.2)`, () => {
  const offTarget: [string, number, number][] = [];

  for (const region of REGIONS) {
    const levels = levelsOf(region);
    console.log(`\n지역 ${region.id} ${region.name} (Lv${region.levelRange.join('~')}) · 조합마다 ${RUNS}회`);
    console.log('  사냥터            ' + levels.map((l) => pad(`Lv${l}`, 16)).join(''));
    console.log('  ' + '─'.repeat(18 + levels.length * 16));

    for (const field of region.fields) {
      const pool = poolOf(field);
      const proper = properLevel(region, field);
      const cells = levels.map((level) => {
        const s = averageOf(pool.map((m) => runPairing(warrior(level), m)));
        expect.soft(s.hardcapRate, `${field.name} Lv${level} 하드캡`).toBe(0);
        const mark = level === proper ? '*' : ' ';
        return pad(`${s.avgActions.toFixed(0)}행동 HP-${pct(1 - s.avgHpLeft, 0)}${mark}`, 16);
      });
      // 적정 레벨의 행동 수는 진단만 한다 — 목표 자체가 낡았다. 아래 ※ 참고.
      const at = averageOf(pool.map((m) => runPairing(warrior(proper), m)));
      offTarget.push([field.name, proper, at.avgActions]);
      console.log(`  ${padEnd(field.name, 16)}` + cells.join('') + ` 적정 Lv${proper}`);
    }
    console.log('  ' + '─'.repeat(18 + levels.length * 16));
  }

  const bad = offTarget.filter(([, , a]) => a < TARGET.min || a > TARGET.max);
  const avg = offTarget.reduce((s, [, , a]) => s + a, 0) / offTarget.length;
  console.log(
    `\n  ※ 적정 레벨 1:1은 평균 ${avg.toFixed(0)}행동이다. §4.2 목표(${TARGET.min}~${TARGET.max})를\n` +
      `    ${bad.length}/${offTarget.length}곳이 벗어나는데, **목표 쪽이 낡았다.**\n` +
      `    §4.2는 "입장 = 전투 1회"이던 v4 기준이고, v5는 한 판에 2~6마리다 (§4.4).\n` +
      `    판 단위로 보면 평균 4마리 × ${avg.toFixed(0)}행동 = ${(avg * 4).toFixed(0)}행동으로 원래 의도한 길이다.\n` +
      `    §4.2의 목표를 판 단위로 다시 쓸지는 기획 결정이라 여기서 안 고친다.`,
  );
});

test('한 판 — 4·6마리 완주율 진단 (§4.4)', () => {
  const entry: number[] = [];
  const atProper: number[] = [];

  for (const region of REGIONS) {
    const levels = levelsOf(region);

    console.log(`\n지역 ${region.id} 연속 전투 (물약·회복 없음). 4마리 완주 / 6마리 완주`);
    console.log('  사냥터            ' + levels.map((l) => pad(`Lv${l}`, 16)).join(''));
    console.log('  ' + '─'.repeat(18 + levels.length * 16));

    for (const field of region.fields) {
      const pool = poolOf(field);
      const proper = properLevel(region, field);
      const cells = levels.map((level) => {
        const [four, six] = RUN_SIZES.map((n) =>
          averageOf(pool.map((m) => runStreak(warrior(level), m, n))),
        );
        if (level === proper) atProper.push(four.clearRate);
        if (level === levels[0]) entry.push(four.clearRate);
        const mark = level === proper ? '*' : ' ';
        return pad(`${pct(four.clearRate, 0)} / ${pct(six.clearRate, 0)}${mark}`, 16);
      });
      console.log(`  ${padEnd(field.name, 16)}` + cells.join('') + ` 적정 Lv${proper}`);
    }
    console.log('  ' + '─'.repeat(18 + levels.length * 16));
  }

  console.log(
    `\n  ★ 4마리 완주율 — 지역에 막 들어갈 때 ${pct(Math.min(...entry), 0)}~${pct(Math.max(...entry), 0)},\n` +
      `    적정 레벨에는 ${pct(Math.min(...atProper), 0)}~${pct(Math.max(...atProper), 0)}.\n` +
      `    T11의 "못 깨거나 100%거나"는 T13에서 닫혔다 — 맨몸은 레벨에 선형으로 자라고(§4.3)\n` +
      `    몬스터와의 격차는 장비가 메운다(§4.5). 위 숫자는 그 레벨 common 풀세트 기준이다.\n` +
      `    들어갈 때 낮은 건 정상이다. 지역 안에서도 쉬운 사냥터부터 도는 게 설계다 (§4.4).`,
  );

  // 적정 레벨에서 절반도 못 깨면 그 지역은 통과 자체가 안 된다. 여기서부터는 검사다.
  expect(Math.min(...atProper), '적정 레벨 4마리 완주율 최저').toBeGreaterThanOrEqual(0.5);
});

test('SPD 비율이 그대로 행동 횟수 비율이 된다 (상한 2배)', () => {
  console.log('\nSPD 비율 → 행동 횟수 비율');

  for (const [playerSpd, monsterSpd, expected] of [
    [13, 10, 1.3],
    [10, 10, 1.0],
    [8, 10, 0.8],
    [100, 10, 2.0], // 상한에 걸려야 한다
  ]) {
    let playerActions = 0;
    let monsterActions = 0;
    for (let seed = 0; seed < RUNS; seed++) {
      // 양쪽 다 안 죽을 만큼 HP를 크게 줘서 비율만 본다
      const r = simulateBattle(
        { ...warrior(1), spd: playerSpd, hp: 1e9, maxHp: 1e9 },
        { ...poolOf(REGIONS[0].fields[0])[0], spd: monsterSpd, hp: 1_500, maxHp: 1_500 },
        makeRng(seed),
      );
      for (const e of r.events) {
        if (e.actor === 'player') playerActions++;
        else monsterActions++;
      }
    }
    const actual = playerActions / monsterActions;
    console.log(
      `  SPD ${pad(playerSpd, 3)} vs ${pad(monsterSpd, 3)} → ${actual.toFixed(3)}` +
        `  (목표 ${expected.toFixed(2)} ± 0.02)`,
    );
    // toBeCloseTo(x, 2)는 허용 오차가 ±0.005라 §4.2의 ±0.02와 다르다. 직접 잰다.
    expect
      .soft(Math.abs(actual - expected), `SPD ${playerSpd}:${monsterSpd} 비율 오차`)
      .toBeLessThanOrEqual(0.02);
  }
  console.log('');
});
