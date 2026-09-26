/**
 * 걸음 목표 · 출석 (T19) — "매일 켤 이유". 3일 소급(§3.6)이 약하게 만든 것을 채운다.
 *
 * **둘 다 [받기]를 눌러야 들어온다** — 저절로 주지 않는다 (검수 주석). 날짜는 wp.ts와 같은 로컬 날짜 키다.
 * 걸음은 WP가 이미 센 값(wp.grantedByDate)을 그대로 쓴다 — 새로 셀 것이 없다.
 * React를 import하지 않는다 — 시뮬도 여기를 지난다.
 */
import { CONSUMABLES, gridItem, regionById } from '../content';
import { dayKey, startOfLocalDay } from '../health/steps';
import type { ItemInstance, Save } from '../save/schema';
import {
  BOSS_DROP_RARITY,
  GEAR_TIERS_PER_REGION,
  REGION_DAILY_GOLD,
  REWARD_GOLD_UNIT,
  rollRarity,
  STEP_GOAL,
  STEP_GOAL_REWARDS,
  STREAK_REWARDS,
  type DailyReward,
} from './formulas';
import { bagFull, makeItem, rollLine } from './items';
import { addItem } from './progression';
import { windowKeys } from './wp';

/** 받은 것 — 화면이 창에 늘어놓는다. 소재는 사냥터 id가 받은 만큼 되풀이된다 */
export type Got = {
  gold: number;
  potions: Record<string, number>;
  materials: string[];
  items: ItemInstance[];
};

const NOTHING: Got = { gold: 0, potions: {}, materials: [], items: [] };

/** 그 지역 물약 — 그 지역에서 새로 파는 것. 엘릭서(비율 회복)는 뺀다 */
export function regionPotion(region: number): string {
  return CONSUMABLES.find((c) => c.region === region && c.healRatio === 0)!.id;
}

/** 칸 하나에 드는 골드 — 그 지역 하루 골드의 비율, 10G 단위로 반올림 */
export function rewardGold(reward: DailyReward, region: number): number {
  const gold = REGION_DAILY_GOLD[region - 1] * (reward.gold ?? 0);
  return Math.round(gold / REWARD_GOLD_UNIT) * REWARD_GOLD_UNIT;
}

/**
 * 칸 하나를 준다. 전부 **지금 있는 지역** 기준이다.
 * 장비 칸인데 가방이 차 있으면 null — 호출부가 거기서 멈추고 기다린다 (검수 주석: 가방을 비우면 받는다).
 */
function give(save: Save, reward: DailyReward, got: Got, rng: () => number) {
  if (reward.gear && bagFull(save)) return null;
  const region = save.regionProgress.current;
  const gold = rewardGold(reward, region);
  let next: Save = { ...save, player: { ...save.player, gold: save.player.gold + gold } };
  const out: Got = {
    gold: got.gold + gold,
    potions: { ...got.potions },
    materials: [...got.materials],
    items: [...got.items],
  };

  if (reward.potion) {
    const id = regionPotion(region);
    next = {
      ...next,
      consumables: { ...next.consumables, [id]: (next.consumables[id] ?? 0) + reward.potion },
    };
    out.potions[id] = (out.potions[id] ?? 0) + reward.potion;
  }

  const fields = regionById(region).fields;
  for (let i = 0; i < (reward.material ?? 0); i++) {
    const id = fields[Math.floor(rng() * fields.length)].id;
    next = { ...next, materials: { ...next.materials, [id]: (next.materials[id] ?? 0) + 1 } };
    out.materials.push(id);
  }

  if (reward.gear) {
    // 그 지역 높은 티어 · 부위 무작위(손이면 지금 계열, T18) · 등급은 보스 보상 표 (희귀 이상)
    const line = rollLine(next, rng);
    const def = gridItem(region * GEAR_TIERS_PER_REGION, line, rollRarity(BOSS_DROP_RARITY, rng));
    const item = makeItem(next.inventory, def.id, rng);
    next = addItem(next, item);
    out.items.push(item);
  }
  return { save: next, got: out };
}

/** 그 걸음 수로 열린 목표 칸 수 (0~6). 5,000보마다 한 칸 */
export function goalCells(steps: number): number {
  return Math.min(STEP_GOAL_REWARDS.length, Math.floor(steps / STEP_GOAL));
}

/**
 * 받을 수 있는 걸음 목표 — 최근 3일(오늘 포함), 날짜별로 [받은 칸, 열린 칸).
 * 안 켠 날의 칸도 3일 안이면 남아 있다 (§3.6 소급과 같은 창).
 * ponytail: 설치 첫날엔 그 전 이틀 걸음의 칸도 열린다 — WP는 막지만(seedInstall) 목표는 작은 선물이라 둔다.
 */
export function goalsReady(save: Save, now: Date): { date: string; from: number; to: number }[] {
  return windowKeys(now)
    .map((date) => ({
      date,
      from: save.daily[date] ?? 0,
      to: goalCells(save.wp.grantedByDate[date] ?? 0),
    }))
    .filter((d) => d.to > d.from);
}

/**
 * 열린 걸음 목표를 전부 받는다. 받을 게 없으면 null.
 * 장비 칸(맨 끝)에서 가방이 차 있으면 거기서 멈춘다 — `waiting`. 3일 안에 가방을 비우면 받는다.
 */
export function claimGoals(save: Save, now: Date, rng: () => number = Math.random) {
  const keys = windowKeys(now);
  // 창 밖의 옛 기록은 버린다. 미래 날짜는 남긴다 — 시계를 되돌렸다 돌아와도 다시 못 받게 (wp.ts와 같다)
  const daily = Object.fromEntries(Object.entries(save.daily).filter(([d]) => d >= keys[0]));
  let next: Save = { ...save, daily };
  let got = NOTHING;
  let waiting = false;
  for (const { date, from, to } of goalsReady(next, now)) {
    for (let cell = from; cell < to; cell++) {
      const given = give(next, STEP_GOAL_REWARDS[cell], got, rng);
      if (!given) {
        waiting = true;
        break;
      }
      next = { ...given.save, daily: { ...given.save.daily, [date]: cell + 1 } };
      got = given.got;
    }
  }
  return got === NOTHING ? null : { save: next, got, waiting };
}

/**
 * 오늘 받을 출석 — 연속 일수와 7칸 중 몇 번째 칸(0부터)인가. 오늘 이미 받았거나 시계를 되돌렸으면 null.
 * 어제 받았으면 이어지고, 하루라도 빠지면 1일째부터다. 7일째 다음은 다시 첫 칸이다 (연속 일수는 계속 센다).
 */
export function streakNext(save: Save, now: Date): { count: number; cell: number } | null {
  const { count, last } = save.streak;
  if (last >= dayKey(now)) return null;
  const next = last === dayKey(startOfLocalDay(now, 1)) ? count + 1 : 1;
  return { count: next, cell: (next - 1) % STREAK_REWARDS.length };
}

/** 오늘 출석을 받는다. 오늘 이미 받았으면 null. 출석표에는 장비 칸이 없어서 가방과 상관없다 */
export function claimStreak(save: Save, now: Date, rng: () => number = Math.random) {
  const next = streakNext(save, now);
  if (!next) return null;
  const given = give(save, STREAK_REWARDS[next.cell], NOTHING, rng);
  if (!given) return null;
  return {
    save: { ...given.save, streak: { count: next.count, last: dayKey(now) } },
    got: given.got,
    count: next.count,
  };
}
