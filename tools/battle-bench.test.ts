/**
 * 전투 엔진 벤치마크 — 조합마다 1,000회를 돌려 승률·행동 수·하드캡 도달률을 출력한다.
 *
 *   npm run bench
 *
 * 숫자를 눈으로 보는 도구이면서, §4.2의 목표(지역1 20~40행동 / 하드캡 0% / SPD 비율)를
 * 그대로 검사한다. 밸런스를 건드려 목표를 벗어나면 여기서 빨갛게 난다.
 * `npm test`는 --dir src라 이 파일을 돌리지 않는다. 진짜 시뮬레이터는 T12.
 */
import { expect, test } from 'vitest';

import { makeRng, simulateBattle, type Combatant } from '../src/game/battle';
import { BASE_STATS } from '../src/game/formulas';

const RUNS = 1_000;
/** §4.2 목표 행동 수 (지역 1, 적정 레벨) */
const TARGET = { min: 20, max: 40 };

/**
 * Lv L 전사. 직업 자동 성장 + 수동 3포인트를 STR/VIT/AGI에 1점씩 균등 배분한 것 (§4.3).
 *
 *   maxHP  +14(전사) +10(VIT)   = +24
 *   ATK    +2.0(전사) +2(STR)   = +4
 *   DEF    +1.5(전사) +0.5(VIT) = +2
 *   SPD    +0.8(전사) +1.5(AGI) = +2.3
 *   EVA               +0.15%p(AGI)
 *
 * T9의 progression.ts가 진짜 계산을 갖게 되면 그걸 쓴다. 여기서는 밸런스 감만 본다.
 */
function warrior(level: number): Combatant {
  const up = level - 1;
  const maxHp = BASE_STATS.maxHp + 24 * up;
  return {
    name: `Lv${level} 전사`,
    hp: maxHp,
    maxHp,
    atk: BASE_STATS.atk + 4 * up,
    def: BASE_STATS.def + 2 * up,
    spd: BASE_STATS.spd + 2.3 * up,
    cri: BASE_STATS.cri,
    crd: BASE_STATS.crd,
    eva: BASE_STATS.eva + 0.0015 * up,
  };
}

/**
 * §7.2④ 생성 공식의 BASE_* 초안. **이 벤치로 역산한 값**이고 확정은 T11 gen-content다.
 * 원형 bias와 power는 평균(1.0)으로 둔다.
 *
 *   hp/def/spd  →  전투가 20~40행동에 끝나도록 (§4.2)
 *   atk         →  한 마리에 플레이어 HP를 약 20% 쓰도록.
 *                  한 판이 평균 4마리(§4.4)라 이 값이 곧 "4마리째에 도망갈까"의 긴장감이다.
 *                  처음엔 4로 잡았다가 1마리에 59%를 쓰길래 역산해서 내렸다.
 */
const MONSTER_BASE = { hp: 110, atk: 1.35, def: 4.2, spd: 9.4 };

/** 한 판의 마릿수. §4.4 삼각분포의 평균(4)과 최대(6) — 이 둘의 차이가 곧 도박이다. */
const RUN_SIZES = [4, 6] as const;

function monsterOfTier(tier: number): Combatant {
  const hp = Math.round(MONSTER_BASE.hp * 1.2 ** tier);
  return {
    name: `티어${tier}`,
    hp,
    maxHp: hp,
    atk: MONSTER_BASE.atk * 1.2 ** tier,
    def: MONSTER_BASE.def * 1.2 ** tier,
    spd: MONSTER_BASE.spd * 1.06 ** tier,
    cri: 0.05,
    crd: 1.5,
    eva: 0.05,
  };
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
const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

test(`지역 1 — 적정 레벨에서 ${TARGET.min}~${TARGET.max}행동, 하드캡 0%`, () => {
  console.log(`\n지역 1 · 전사 · 스탯 균등 배분 · 티어 = 레벨 · 조합마다 ${RUNS}회`);
  console.log('  1:1 전투');
  console.log('  Lv  몬스터     승률   평균행동   최소   최대   하드캡   남은HP');
  console.log('  ' + '─'.repeat(62));

  for (const level of [1, 2, 3, 5, 7, 10]) {
    const player = warrior(level);
    const monster = monsterOfTier(level);
    const s = runPairing(player, monster);

    console.log(
      `  ${pad(level, 2)}  ${pad(monster.name, 7)}  ${pad(pct(s.winRate), 7)}  ` +
        `${pad(s.avgActions.toFixed(1), 8)}  ${pad(s.minActions, 5)}  ${pad(s.maxActions, 5)}  ` +
        `${pad(pct(s.hardcapRate), 7)}  ${pad(pct(s.avgHpLeft, 0), 7)}`,
    );

    expect.soft(s.avgActions, `Lv${level} 평균 행동 수`).toBeGreaterThanOrEqual(TARGET.min);
    expect.soft(s.avgActions, `Lv${level} 평균 행동 수`).toBeLessThanOrEqual(TARGET.max);
    expect.soft(s.hardcapRate, `Lv${level} 하드캡 도달률`).toBe(0);
  }
  console.log('  ' + '─'.repeat(62));
});

test('연속 전투 — 평균 판(4마리)은 물약 없이 깰 수 있어야 한다 (§4.4)', () => {
  console.log('\n  연속 전투 (물약·회복 없음. HP는 전투 사이에 이어진다)');
  console.log('  Lv  몬스터    4마리 완주   남은HP    6마리 완주   남은HP');
  console.log('  ' + '─'.repeat(60));

  const sixRates: number[] = [];

  for (const level of [1, 2, 3, 5, 7, 10]) {
    const player = warrior(level);
    const monster = monsterOfTier(level);
    const [four, six] = RUN_SIZES.map((n) => runStreak(player, monster, n));
    sixRates.push(six.clearRate);

    console.log(
      `  ${pad(level, 2)}  ${pad(monster.name, 7)}  ${pad(pct(four.clearRate), 10)}  ` +
        `${pad(pct(four.avgHpLeft, 0), 7)}  ${pad(pct(six.clearRate), 11)}  ` +
        `${pad(pct(six.avgHpLeft, 0), 7)}`,
    );

    // 지켜야 하는 최소선: 평균 마릿수(4)를 물약 없이 못 깨면 물약 3개로도 사냥터가 안 굴러간다.
    expect.soft(four.clearRate, `Lv${level} 4마리 완주율`).toBeGreaterThan(0.8);
  }
  console.log('  ' + '─'.repeat(60));

  // 6마리는 검사하지 않고 진단만 한다 — 고치려면 몬스터 성장 곡선을 손봐야 하고,
  // 그건 T11(몬스터 스펙)과 T12(시뮬레이터)의 일이다.
  const spread = Math.max(...sixRates) - Math.min(...sixRates);
  if (spread > 0.2) {
    console.log(
      `  ※ 6마리 완주율이 레벨대별로 ${pct(Math.min(...sixRates), 0)}~${pct(Math.max(...sixRates), 0)}로 튄다.\n` +
        `    플레이어는 선형(+24HP/+4ATK per Lv), 몬스터는 지수(×1.2^티어) 성장이라 곡선이 어긋난다.\n` +
        `    BASE_* 네 값으로는 못 고친다(모든 티어에 같은 배율로 곱해지므로). T11에서 다룰 것.`,
    );
  }
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
        { ...monsterOfTier(1), spd: monsterSpd, hp: 1_500, maxHp: 1_500 },
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
