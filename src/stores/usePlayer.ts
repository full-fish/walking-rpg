import { create } from 'zustand';

import type { DailySteps } from '@/health/steps';
import { grantWp, spendWp } from '@/game/wp';
import type { Save } from '@/save/schema';
import { loadSave, resetSave, writeSave } from '@/save/store';

type PlayerStore = {
  save: Save;
  /** 걸음 기록을 WP로 바꾼다. 중복 지급은 grantWp가 막으므로 몇 번 불러도 안전하다 */
  grantFromSteps: (steps: DailySteps) => void;
  /** WP를 쓴다. 모자라면 아무것도 바꾸지 않고 false */
  spend: (cost: number) => boolean;
  addGold: (amount: number) => void;
  reset: () => void;
};

/** 상태가 바뀔 때마다 즉시 MMKV에 쓴다. 스로틀 없음 — 동기 저장이라 1ms 미만 (§5.5). */
function persist(save: Save): Save {
  writeSave(save);
  return save;
}

/**
 * 게임 상태 한 곳. 원본은 항상 MMKV에 있고 이 스토어는 그 사본이다.
 * MMKV가 동기라 첫 렌더 전에 loadSave()로 채울 수 있다(로딩 상태 불필요).
 */
export const usePlayer = create<PlayerStore>((set, get) => ({
  save: loadSave(),

  grantFromSteps: (steps) => {
    const { save } = get();
    const { state, granted } = grantWp(save.wp, steps, new Date());
    // 받을 게 없으면 저장도 리렌더도 하지 않는다. 60초마다 불리는 경로다.
    if (granted === 0) return;
    set({ save: persist({ ...save, wp: state }) });
  },

  spend: (cost) => {
    const { save } = get();
    const wp = spendWp(save.wp, cost);
    if (!wp) return false;
    set({ save: persist({ ...save, wp }) });
    return true;
  },

  addGold: (amount) => {
    const { save } = get();
    const gold = Math.max(0, save.player.gold + amount);
    set({ save: persist({ ...save, player: { ...save.player, gold } }) });
  },

  reset: () => set({ save: resetSave() }),
}));
