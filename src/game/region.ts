/**
 * 지역 이동 · 보스 · 해금 (§4.1, §4.4, T17_5).
 *
 * 지역 r을 벗어나는 관문은 셋이고, **셋 다 따로 낸다** — 보스 도전(처음 10,000 × 1.1^(r-1),
 * 그 뒤로는 재도전 3,000 × 1.1^(r-1)) → 해금(10,000 × 1.1^(r-1)) → 이동(매번 1,000).
 * 셋 다 마을에서만 된다(run === null). 전부 실패하면 null이다 — economy.ts와 같은 규약.
 * React를 import하지 않는다 — Node에서 돌아야 한다.
 */
import { bossOf } from '../content';
import type { Save } from '../save/schema';
import { pickMaterials } from './economy';
import { MATERIAL_BUFF, REGION_COUNT, WP_COST } from './formulas';
import { addBuffs, openRun } from './field';
import { bagFull } from './items';
import { spendWp } from './wp';

/** 그 지역 보스와의 기록. 한 번도 안 싸웠으면 untried다. */
export type BossState = 'untried' | 'tried' | 'cleared';

export function bossState(save: Save, region: number): BossState {
  return save.regionProgress.bosses[region] ?? 'untried';
}

/** 보스 도전 값 (§4.1). 처음이면 첫 도전 값, 한 번이라도 들어갔으면 재도전 값이다. */
export function bossCost(save: Save, region: number): number {
  return bossState(save, region) === 'untried'
    ? WP_COST.bossFirst(region)
    : WP_COST.bossRetry(region);
}

/** 해금된 다른 지역으로 간다. 같은 지역 안(마을 ↔ 사냥터)은 무료지만 지역 사이는 매번 낸다. */
export function travel(save: Save, region: number): Save | null {
  const { current, unlocked } = save.regionProgress;
  if (save.run !== null || region === current || region < 1 || region > unlocked) return null;

  const wp = spendWp(save.wp, WP_COST.regionTravel);
  if (!wp) return null;
  return { ...save, wp, regionProgress: { ...save.regionProgress, current: region } };
}

/**
 * 지금 지역의 보스에 도전한다 (§4.4). 몰이사냥이 아니라 1:1이다 — size 1짜리 판으로 연다.
 *
 * 들어가는 순간 'tried'로 적는다. 지든 나가든 비용은 안 돌아오고 다음은 재도전 값이다.
 * **가방이 차 있으면 못 들어간다** — 이기면 장비를 확정으로 주는데 받을 칸이 없으면
 * 관문 값을 치른 보상이 통째로 날아간다.
 *
 * 소재 버프는 들어간 뒤 판 안에서 붙인다(addBuffs, T17_7 검수 5차 — 화면은 [버프] 창).
 * `materials`(개수)는 시뮬용이다 — 들어가면서 그만큼 알아서 골라 붙인다. 소재가 모자라면 못 들어간다.
 */
export function enterBoss(save: Save, materials = 0, rng: () => number = Math.random): Save | null {
  const region = save.regionProgress.current;
  if (save.run !== null || bagFull(save) || bossState(save, region) === 'cleared') return null;

  const n = Math.min(materials, MATERIAL_BUFF.max);
  if (n > 0 && !pickMaterials(save, region, n, false)) return null;
  const wp = spendWp(save.wp, bossCost(save, region));
  if (!wp) return null;

  const tried: Save = {
    ...save,
    wp,
    regionProgress: {
      ...save.regionProgress,
      bosses: { ...save.regionProgress.bosses, [region]: 'tried' },
    },
  };
  const opened = openRun(tried, {
    fieldId: `boss_r${region}`,
    size: 1,
    killed: 0,
    earned: { exp: 0, gold: 0 },
    monsterId: bossOf(region).id,
    boss: true,
    buffs: [],
  });
  return n > 0 ? addBuffs(opened, n, rng) : opened;
}

/** 다음 지역의 해금 값 (§4.1). r은 지금까지 연 가장 높은 지역 — 그 보스를 잡았어야 한다. */
export function unlockCost(save: Save): number {
  return WP_COST.regionUnlock(save.regionProgress.unlocked);
}

/**
 * 다음 지역을 연다 (§4.1). **이동은 따로 한다** — 여기서는 갈 수 있게만 만든다.
 * 지금까지 연 가장 높은 지역의 보스를 잡았어야 하고, 마지막 지역 다음은 없다.
 */
export function unlockNext(save: Save): Save | null {
  const { unlocked } = save.regionProgress;
  if (save.run !== null || unlocked >= REGION_COUNT) return null;
  if (bossState(save, unlocked) !== 'cleared') return null;

  const wp = spendWp(save.wp, unlockCost(save));
  if (!wp) return null;
  return { ...save, wp, regionProgress: { ...save.regionProgress, unlocked: unlocked + 1 } };
}
